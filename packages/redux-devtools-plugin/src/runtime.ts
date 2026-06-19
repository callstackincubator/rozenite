import { parse, stringify } from 'jsan';
import {
  Action,
  Reducer,
  StoreEnhancer,
  StoreEnhancerStoreCreator,
} from 'redux';
import { instrument } from '@redux-devtools/instrument';
import type {
  EnhancedStore,
  LiftedState,
  PerformAction,
} from '@redux-devtools/instrument';
import { evalAction } from '@redux-devtools/utils';
import {
  getRuntimeConnectionId,
  sendRuntimeMessage,
  subscribeToPanelCommands,
} from './runtime-bridge';
import { registerReduxDevToolsStore } from './redux-devtools-registry';
import type { ReduxActionTrace, ReduxActionWithTrace } from './shared/trace';
import type {
  ReduxDevToolsPanelCommand,
  ReduxDevToolsRequest,
} from './shared/protocol';
import { resolveReduxTrace } from './symbolication/trace';

const getRandomId = () => Math.random().toString(36).slice(2);
const MAX_QUEUED_COMMANDS = 50;
const TRACE_SNAPSHOT_DEBOUNCE_MS = 50;
const PARTIAL_STATE_CHUNK_SIZE = 1;
const STORE_SENTINEL = Symbol.for('rozenite.redux-devtools.store-sentinel');

type AnyAction = Action<string>;

/**
 * Options for configuring Rozenite Redux DevTools
 */
export interface RozeniteDevToolsOptions {
  /**
   * Store display name shown in Redux DevTools instance selector.
   * Use different names when instrumenting multiple stores.
   *
   * @default 'Redux Store'
   */
  name?: string;

  /**
   * Maximum number of actions to be stored in the history tree.
   * The oldest actions are removed once maxAge is reached.
   * This is critical for performance.
   *
   * @default 50
   */
  maxAge?: number;

  /**
   * Capture a JavaScript stack trace for each dispatched action.
   *
   * When enabled, Rozenite stores the raw Redux DevTools stack and attempts
   * to symbolicate it through Metro so the Trace tab can show source files
   * instead of generated bundle locations.
   *
   * @default false
   */
  trace?: boolean | ((action: AnyAction) => string | undefined);

  /**
   * Maximum number of stack frames captured for each action.
   *
   * @default 25 when trace is enabled
   */
  traceLimit?: number;

  /**
   * Attempt to source-map captured stacks through Metro's /symbolicate endpoint.
   *
   * @default true
   */
  traceSymbolication?: boolean;

  /**
   * Sanitizes each Redux state snapshot before it is sent to DevTools.
   * Useful for omitting large caches, entity maps, or sensitive values.
   */
  stateSanitizer?: (state: unknown, index: number) => unknown;

  /**
   * Sanitizes each Redux action before it is sent to DevTools.
   * Useful for omitting large payloads or sensitive values.
   */
  actionSanitizer?: (action: AnyAction, id: number) => unknown;
}

type RuntimeController = {
  enhance: () => StoreEnhancer;
  isLocked: () => boolean;
};

type StoreSentinel = {
  instanceId: string;
  unsubscribeCommandHandler: () => void;
};

const commandHandlers = new Set<(command: ReduxDevToolsPanelCommand) => void>();
let bridgeUnsubscribe: (() => void) | null = null;

const ensureBridgeSubscription = () => {
  if (bridgeUnsubscribe) {
    return;
  }

  bridgeUnsubscribe = subscribeToPanelCommands((command) => {
    commandHandlers.forEach((handler) => {
      handler(command);
    });
  });
};

const registerCommandHandler = (
  handler: (command: ReduxDevToolsPanelCommand) => void
): (() => void) => {
  commandHandlers.add(handler);
  ensureBridgeSubscription();

  return () => {
    commandHandlers.delete(handler);

    if (commandHandlers.size === 0 && bridgeUnsubscribe) {
      bridgeUnsubscribe();
      bridgeUnsubscribe = null;
    }
  };
};

const createRuntimeController = (
  options: RozeniteDevToolsOptions = {}
): RuntimeController => {
  const appInstanceId = getRandomId();
  const instanceName = options.name?.trim() || 'Redux Store';
  const maxAge = options.maxAge ?? 50;
  const trace = options.trace;
  const traceLimit = trace ? (options.traceLimit ?? 25) : options.traceLimit;
  const traceSymbolication = options.traceSymbolication ?? true;

  let store: EnhancedStore<any, AnyAction, unknown> | null = null;
  let monitored = false;
  let lastAction: string | undefined;
  const pendingCommands: ReduxDevToolsPanelCommand[] = [];
  const tracesByActionId = new Map<number, ReduxActionTrace>();
  const pendingTraceKeys = new Set<string>();
  let traceSnapshotTimer: ReturnType<typeof setTimeout> | null = null;
  const reportedSanitizerErrors = new Set<string>();

  const enqueueCommand = (command: ReduxDevToolsPanelCommand) => {
    if (pendingCommands.length >= MAX_QUEUED_COMMANDS) {
      pendingCommands.shift();
    }

    pendingCommands.push(command);
  };

  const getLiftedStateRaw = (): LiftedState<any, AnyAction, unknown> | null => {
    if (!store) {
      return null;
    }

    return store.liftedStore.getState() as LiftedState<any, AnyAction, unknown>;
  };

  const sendError = (message: string): void => {
    sendRuntimeMessage({
      type: 'error',
      message,
    });
  };

  const reportSanitizerError = (kind: 'state' | 'action', error: unknown) => {
    const message = (error as Error).message || String(error);
    const key = `${kind}:${message}`;

    if (reportedSanitizerErrors.has(key)) {
      return;
    }

    reportedSanitizerErrors.add(key);
    sendError(`Redux DevTools ${kind} sanitizer failed: ${message}`);
  };

  const sanitizeState = (state: unknown, index: number): unknown => {
    if (!options.stateSanitizer) {
      return state;
    }

    try {
      return options.stateSanitizer(state, index);
    } catch (error) {
      reportSanitizerError('state', error);
      return {
        __rozeniteSanitizerError: 'State sanitizer failed.',
      };
    }
  };

  const sanitizeAction = (action: AnyAction, id: number): unknown => {
    if (!options.actionSanitizer) {
      return action;
    }

    try {
      return options.actionSanitizer(action, id);
    } catch (error) {
      reportSanitizerError('action', error);
      return {
        type:
          action &&
          typeof action === 'object' &&
          'type' in action &&
          (action as { type?: unknown }).type != null
            ? String((action as { type?: unknown }).type)
            : '@@SANITIZER_ERROR',
        __rozeniteSanitizerError: 'Action sanitizer failed.',
      };
    }
  };

  const sanitizeComputedState = (
    entry: { state: unknown; error?: string },
    index: number
  ) => ({
    ...entry,
    state: sanitizeState(entry.state, index),
  });

  const sanitizeLiftedAction = (
    liftedAction: PerformAction<AnyAction>,
    actionId: number
  ): PerformAction<AnyAction> => {
    if (liftedAction.type !== 'PERFORM_ACTION') {
      return liftedAction;
    }

    return {
      ...liftedAction,
      action: sanitizeAction(liftedAction.action, actionId) as AnyAction,
    };
  };

  const sendRequest = (request: ReduxDevToolsRequest): void => {
    sendRuntimeMessage({
      type: 'state-update',
      connectionId: getRuntimeConnectionId(),
      request,
    });
  };

  const scheduleTraceSnapshot = (): void => {
    if (!monitored || traceSnapshotTimer) {
      return;
    }

    traceSnapshotTimer = setTimeout(() => {
      traceSnapshotTimer = null;

      if (monitored) {
        sendStateSnapshot();
      }
    }, TRACE_SNAPSHOT_DEBOUNCE_MS);
  };

  const pruneActionTraces = (
    liftedState: LiftedState<any, AnyAction, unknown>
  ): void => {
    const actionIds = new Set(liftedState.stagedActionIds);

    tracesByActionId.forEach((trace, actionId) => {
      const liftedAction = liftedState.actionsById[
        actionId
      ] as ReduxActionWithTrace | undefined;

      if (!actionIds.has(actionId) || liftedAction?.stack !== trace.rawStack) {
        tracesByActionId.delete(actionId);
      }
    });
  };

  const resolveTraceForAction = (
    actionId: number,
    rawStack: string
  ): ReduxActionTrace => {
    const existingTrace = tracesByActionId.get(actionId);
    if (existingTrace?.rawStack === rawStack) {
      return existingTrace;
    }

    const { initialTrace, pendingTrace } = resolveReduxTrace(rawStack, {
      symbolicate: traceSymbolication,
    });

    tracesByActionId.set(actionId, initialTrace);

    const pendingTraceKey = `${actionId}:${rawStack}`;

    if (pendingTrace && !pendingTraceKeys.has(pendingTraceKey)) {
      pendingTraceKeys.add(pendingTraceKey);
      pendingTrace
        .then((resolvedTrace) => {
          const currentTrace = tracesByActionId.get(actionId);
          if (currentTrace?.rawStack !== rawStack) {
            return;
          }

          tracesByActionId.set(actionId, resolvedTrace);
          scheduleTraceSnapshot();
        })
        .finally(() => {
          pendingTraceKeys.delete(pendingTraceKey);
        });
    }

    return initialTrace;
  };

  const decorateLiftedAction = (
    actionId: number,
    liftedAction: PerformAction<AnyAction>
  ) => {
    const rawStack = (liftedAction as ReduxActionWithTrace).stack;

    if (typeof rawStack !== 'string' || rawStack.length === 0) {
      return liftedAction;
    }

    return {
      ...liftedAction,
      rozeniteTrace: resolveTraceForAction(actionId, rawStack),
    };
  };

  const sendStateSnapshot = (): void => {
    const liftedState = getLiftedStateRaw();

    if (!liftedState) {
      return;
    }

    pruneActionTraces(liftedState);

    const initialComputedState = liftedState.computedStates[0];
    const initialStagedActionId = liftedState.stagedActionIds[0] ?? 0;
    const initialAction = liftedState.actionsById[initialStagedActionId] as
      | PerformAction<AnyAction>
      | undefined;

    sendRequest({
      type: 'STATE',
      name: instanceName,
      instanceId: appInstanceId,
      payload: stringify({
        actionsById: initialAction
          ? {
              [initialStagedActionId]: sanitizeLiftedAction(
                decorateLiftedAction(initialStagedActionId, initialAction),
                initialStagedActionId
              ),
            }
          : {},
        computedStates: initialComputedState
          ? [sanitizeComputedState(initialComputedState, 0)]
          : [],
        committedState: sanitizeState(liftedState.committedState, 0),
        currentStateIndex: 0,
        nextActionId: initialStagedActionId + 1,
        skippedActionIds: [],
        stagedActionIds: [initialStagedActionId],
        isLocked: liftedState.isLocked,
        isPaused: liftedState.isPaused,
      }),
    });

    for (
      let startIndex = 1;
      startIndex < liftedState.stagedActionIds.length;
      startIndex += PARTIAL_STATE_CHUNK_SIZE
    ) {
      const endIndex = Math.min(
        startIndex + PARTIAL_STATE_CHUNK_SIZE,
        liftedState.stagedActionIds.length
      );
      const chunkStagedActionIds = liftedState.stagedActionIds.slice(
        startIndex,
        endIndex
      );
      const actionsById: Record<number, PerformAction<AnyAction>> = {};

      chunkStagedActionIds.forEach((actionId) => {
        const action = liftedState.actionsById[actionId] as
          | PerformAction<AnyAction>
          | undefined;

        if (action) {
          actionsById[actionId] = sanitizeLiftedAction(
            decorateLiftedAction(actionId, action),
            actionId
          );
        }
      });

      const stagedActionIds = liftedState.stagedActionIds.slice(0, endIndex);
      const lastActionId =
        stagedActionIds[stagedActionIds.length - 1] ?? initialStagedActionId;

      sendRequest({
        type: 'PARTIAL_STATE',
        name: instanceName,
        instanceId: appInstanceId,
        maxAge: Math.max(maxAge, liftedState.nextActionId),
        committedState: sanitizeState(liftedState.committedState, 0),
        payload: stringify({
          actionsById,
          computedStates: liftedState.computedStates
            .slice(startIndex, endIndex)
            .map((entry, index) =>
              sanitizeComputedState(entry, startIndex + index)
            ),
          currentStateIndex: Math.min(
            liftedState.currentStateIndex,
            stagedActionIds.length - 1
          ),
          nextActionId:
            endIndex === liftedState.stagedActionIds.length
              ? liftedState.nextActionId
              : lastActionId + 1,
          skippedActionIds: liftedState.skippedActionIds.filter((actionId) =>
            stagedActionIds.includes(actionId)
          ),
          stagedActionIds,
          isLocked: liftedState.isLocked,
          isPaused: liftedState.isPaused,
        }),
      });
    }
  };

  const sendActionUpdate = (): void => {
    if (!store) {
      return;
    }

    const liftedState = getLiftedStateRaw();
    if (!liftedState) {
      return;
    }

    pruneActionTraces(liftedState);

    const nextActionId = liftedState.nextActionId;
    const liftedAction = liftedState.actionsById[
      nextActionId - 1
    ] as PerformAction<AnyAction> | undefined;

    if (!liftedAction) {
      sendStateSnapshot();
      return;
    }

    sendRequest({
      type: 'ACTION',
      name: instanceName,
      instanceId: appInstanceId,
      payload: stringify(
        sanitizeState(store.getState(), liftedState.currentStateIndex)
      ),
      action: stringify(
        sanitizeLiftedAction(
          decorateLiftedAction(nextActionId - 1, liftedAction),
          nextActionId - 1
        )
      ),
      nextActionId,
      maxAge,
      isExcess: liftedState.stagedActionIds.length >= maxAge,
    });
  };

  const dispatchRemotely = (
    action: string | { args: string[]; rest: string; selected: number }
  ): void => {
    if (!store) {
      enqueueCommand({ type: 'action', action, instanceId: appInstanceId });
      return;
    }

    try {
      const result = evalAction(action, []);
      store.dispatch(result as AnyAction);
    } catch (error) {
      sendError((error as Error).message);
    }
  };

  const isTargeted = (command: ReduxDevToolsPanelCommand): boolean => {
    if ('toAll' in command && command.toAll) {
      return true;
    }

    if (!('instanceId' in command)) {
      return true;
    }

    if (command.instanceId == null) {
      return true;
    }

    return command.instanceId === appInstanceId;
  };

  const handlePanelCommand = (command: ReduxDevToolsPanelCommand): void => {
    if (!isTargeted(command)) {
      return;
    }

    if (!store) {
      if (command.type === 'stop') {
        monitored = false;
        return;
      }

      if (command.type === 'start') {
        monitored = true;
      }

      enqueueCommand(command);
      return;
    }

    switch (command.type) {
      case 'request-state':
      case 'update': {
        sendStateSnapshot();
        break;
      }
      case 'start': {
        monitored = true;
        sendStateSnapshot();
        break;
      }
      case 'stop': {
        monitored = false;
        break;
      }
      case 'dispatch': {
        store.liftedStore.dispatch(command.action as any);
        break;
      }
      case 'action': {
        dispatchRemotely(command.action);
        break;
      }
      case 'import-state': {
        try {
          store.liftedStore.dispatch({
            type: 'IMPORT_STATE',
            nextLiftedState: parse(command.state),
          } as any);
        } catch (error) {
          sendError((error as Error).message);
        }
        break;
      }
      default:
        break;
    }
  };

  const flushPendingCommands = () => {
    if (!store || pendingCommands.length === 0) {
      return;
    }

    const toHandle = pendingCommands.splice(0, pendingCommands.length);
    toHandle.forEach((command) => {
      handlePanelCommand(command);
    });
  };

  const monitorReducer = (state = {}, action: { type: string }) => {
    lastAction = action.type;
    return state;
  };

  const handleChange = () => {
    if (!monitored) {
      return;
    }

    if (lastAction === 'PERFORM_ACTION') {
      sendActionUpdate();
      return;
    }

    sendStateSnapshot();
  };

  return {
    isLocked: () => {
      const liftedState = getLiftedStateRaw();
      return Boolean(liftedState?.isLocked);
    },
    enhance: () => {
      return ((next: StoreEnhancerStoreCreator) => {
        return (
          reducer: Reducer<any, AnyAction>,
          initialState?: unknown
        ) => {
          store = instrument(monitorReducer, {
            maxAge,
            trace,
            traceLimit,
            shouldHotReload: true,
            shouldRecordChanges: true,
            pauseActionType: '@@PAUSED',
          })(next)(reducer, initialState) as EnhancedStore<any, AnyAction, unknown>;

          const storeWithSentinel = store as EnhancedStore<any, AnyAction, unknown> & {
            [STORE_SENTINEL]?: StoreSentinel;
          };

          if (!storeWithSentinel[STORE_SENTINEL]) {
            const unsubscribeCommandHandler = registerCommandHandler(
              handlePanelCommand
            );
            storeWithSentinel[STORE_SENTINEL] = {
              instanceId: appInstanceId,
              unsubscribeCommandHandler: unsubscribeCommandHandler,
            };
          }

          registerReduxDevToolsStore({
            instanceId: appInstanceId,
            name: instanceName,
            maxAge,
            getStore: () => store,
            getLiftedState: () => getLiftedStateRaw(),
            getActionTrace: (actionId) => tracesByActionId.get(actionId) ?? null,
          });

          store.subscribe(() => {
            handleChange();
          });

          flushPendingCommands();

          return store;
        };
      }) as StoreEnhancer;
    },
  };
};

export const rozeniteDevToolsEnhancer = (
  options: RozeniteDevToolsOptions = {}
): StoreEnhancer => {
  return createRuntimeController(options).enhance();
};

const composeWithOptions = (options: RozeniteDevToolsOptions) => {
  return (...funcs: StoreEnhancer[]) => {
    return (...args: [StoreEnhancerStoreCreator]) => {
      const controller = createRuntimeController(options);

      const preEnhancer = ((createStore: any) => {
        return (reducer: any, preloadedState?: unknown) => {
          const composedStore = createStore(reducer, preloadedState);

          return {
            ...composedStore,
            dispatch: (action: AnyAction) =>
              controller.isLocked() ? action : composedStore.dispatch(action),
          };
        };
      }) as StoreEnhancer;

      return [preEnhancer, ...funcs].reduceRight(
        (composed, enhancer) => enhancer(composed),
        controller.enhance()(...args)
      );
    };
  };
};

export const composeWithRozeniteDevTools = (
  ...funcs: [RozeniteDevToolsOptions] | StoreEnhancer[]
) => {
  if (funcs.length === 0) {
    return rozeniteDevToolsEnhancer();
  }

  if (funcs.length === 1 && typeof funcs[0] === 'object') {
    return composeWithOptions(funcs[0] as RozeniteDevToolsOptions);
  }

  return composeWithOptions({})(...(funcs as StoreEnhancer[]));
};
