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
import type {
  ReduxDevToolsPanelCommand,
  ReduxDevToolsRequest,
} from './shared/protocol';

const getRandomId = () => Math.random().toString(36).slice(2);
const MAX_QUEUED_COMMANDS = 50;
const STORE_SENTINEL = Symbol.for('rozenite.redux-devtools.store-sentinel');

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
}

type AnyAction = Action<string>;

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

  let store: EnhancedStore<any, AnyAction, unknown> | null = null;
  let monitored = false;
  let lastAction: string | undefined;
  const pendingCommands: ReduxDevToolsPanelCommand[] = [];

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

  const sendRequest = (request: ReduxDevToolsRequest): void => {
    sendRuntimeMessage({
      type: 'state-update',
      connectionId: getRuntimeConnectionId(),
      request,
    });
  };

  const sendStateSnapshot = (): void => {
    const liftedState = getLiftedStateRaw();

    if (!liftedState) {
      return;
    }

    sendRequest({
      type: 'STATE',
      name: instanceName,
      instanceId: appInstanceId,
      payload: stringify(liftedState),
    });
  };

  const sendActionUpdate = (): void => {
    if (!store) {
      return;
    }

    const liftedState = getLiftedStateRaw();
    if (!liftedState) {
      return;
    }

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
      payload: stringify(store.getState()),
      action: stringify(liftedAction),
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
