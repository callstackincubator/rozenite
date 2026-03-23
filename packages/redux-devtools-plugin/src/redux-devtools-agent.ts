import { ActionCreators } from '@redux-devtools/instrument';
import type { Action } from 'redux';
import { parse, stringify } from 'jsan';
import type { AgentTool } from '@rozenite/agent-bridge';
import {
  getReduxDevToolsStore,
  listReduxDevToolsStores,
  type ReduxDevToolsLiftedState,
  type ReduxDevToolsStoreRegistration,
} from './redux-devtools-registry';

type AnyAction = Action<string> & Record<string, unknown>;

type StoreInput = {
  instanceId?: string;
};

type PaginatedStoreInput = StoreInput & {
  offset?: number;
  limit?: number;
};

type ActionInput = {
  instanceId?: string;
  actionId: number;
};

type DispatchActionInput = {
  instanceId?: string;
  action: unknown;
};

type BooleanStateInput = {
  instanceId?: string;
  locked?: boolean;
  paused?: boolean;
};

const pluginId = '@rozenite/redux-devtools-plugin';
const DEFAULT_PAGE_LIMIT = 50;

export const listStoresTool: AgentTool = {
  name: 'list-stores',
  description:
    'List all Redux DevTools store instances currently registered on the device.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const getStoreStateTool: AgentTool = {
  name: 'get-store-state',
  description:
    'Return the current Redux store state together with lifted Redux DevTools metadata.',
  inputSchema: {
    type: 'object',
    properties: {
      instanceId: {
        type: 'string',
        description: 'Redux DevTools instance ID. Optional when only one store is registered.',
      },
    },
  },
};

export const listActionsTool: AgentTool = {
  name: 'list-actions',
  description:
    'List Redux action history for a store in newest-first order using pagination.',
  inputSchema: {
    type: 'object',
    properties: {
      instanceId: {
        type: 'string',
        description: 'Redux DevTools instance ID. Optional when only one store is registered.',
      },
      offset: {
        type: 'number',
        description: 'Pagination offset. Defaults to 0.',
      },
      limit: {
        type: 'number',
        description: 'Pagination size. Defaults to 50.',
      },
    },
  },
};

export const getActionDetailsTool: AgentTool = {
  name: 'get-action-details',
  description:
    'Return the lifted action payload, computed state, and metadata for a Redux action history entry.',
  inputSchema: {
    type: 'object',
    properties: {
      instanceId: {
        type: 'string',
        description: 'Redux DevTools instance ID. Optional when only one store is registered.',
      },
      actionId: {
        type: 'number',
        description: 'Redux DevTools action ID to inspect.',
      },
    },
    required: ['actionId'],
  },
};

export const dispatchActionTool: AgentTool = {
  name: 'dispatch-action',
  description:
    'Dispatch a plain serializable Redux action through the real store dispatch path.',
  inputSchema: {
    type: 'object',
    properties: {
      instanceId: {
        type: 'string',
        description: 'Redux DevTools instance ID. Optional when only one store is registered.',
      },
      action: {
        type: 'object',
        description: 'Plain serializable Redux action object with a string type.',
      },
    },
    required: ['action'],
  },
};

export const jumpToActionTool: AgentTool = {
  name: 'jump-to-action',
  description: 'Jump Redux DevTools to a specific action in history.',
  inputSchema: {
    type: 'object',
    properties: {
      instanceId: {
        type: 'string',
        description: 'Redux DevTools instance ID. Optional when only one store is registered.',
      },
      actionId: {
        type: 'number',
        description: 'Redux DevTools action ID to jump to.',
      },
    },
    required: ['actionId'],
  },
};

export const toggleActionTool: AgentTool = {
  name: 'toggle-action',
  description: 'Toggle whether a Redux DevTools action is skipped in history recomputation.',
  inputSchema: {
    type: 'object',
    properties: {
      instanceId: {
        type: 'string',
        description: 'Redux DevTools instance ID. Optional when only one store is registered.',
      },
      actionId: {
        type: 'number',
        description: 'Redux DevTools action ID to toggle.',
      },
    },
    required: ['actionId'],
  },
};

const storeOnlyProperties = {
  instanceId: {
    type: 'string',
    description: 'Redux DevTools instance ID. Optional when only one store is registered.',
  },
} as const;

export const resetHistoryTool: AgentTool = {
  name: 'reset-history',
  description: 'Reset Redux DevTools history for the selected store.',
  inputSchema: {
    type: 'object',
    properties: storeOnlyProperties,
  },
};

export const rollbackStateTool: AgentTool = {
  name: 'rollback-state',
  description:
    'Rollback Redux DevTools state for the selected store to the last committed snapshot.',
  inputSchema: {
    type: 'object',
    properties: storeOnlyProperties,
  },
};

export const commitCurrentStateTool: AgentTool = {
  name: 'commit-current-state',
  description:
    'Commit the current Redux DevTools state and clear prior history for the selected store.',
  inputSchema: {
    type: 'object',
    properties: storeOnlyProperties,
  },
};

export const sweepSkippedActionsTool: AgentTool = {
  name: 'sweep-skipped-actions',
  description: 'Remove skipped Redux DevTools actions from history for the selected store.',
  inputSchema: {
    type: 'object',
    properties: storeOnlyProperties,
  },
};

export const setRecordingPausedTool: AgentTool = {
  name: 'set-recording-paused',
  description: 'Pause or resume Redux DevTools action recording for the selected store.',
  inputSchema: {
    type: 'object',
    properties: {
      ...storeOnlyProperties,
      paused: {
        type: 'boolean',
        description: 'Whether Redux DevTools recording should be paused.',
      },
    },
    required: ['paused'],
  },
};

export const setLockedTool: AgentTool = {
  name: 'set-locked',
  description: 'Lock or unlock Redux DevTools changes for the selected store.',
  inputSchema: {
    type: 'object',
    properties: {
      ...storeOnlyProperties,
      locked: {
        type: 'boolean',
        description: 'Whether Redux DevTools should lock state changes.',
      },
    },
    required: ['locked'],
  },
};

const serializeForAgent = <T>(value: T): T => {
  return parse(stringify(value)) as T;
};

const getActionDisplayType = (
  liftedState: ReduxDevToolsLiftedState,
  actionId: number
) => {
  const liftedAction = liftedState.actionsById[actionId];
  if (!liftedAction) {
    return '(unknown)';
  }

  const rawAction = liftedAction.action as { type?: unknown } | undefined;
  if (rawAction && typeof rawAction.type === 'string') {
    return rawAction.type;
  }

  if (rawAction && rawAction.type != null) {
    return String(rawAction.type);
  }

  return liftedAction.type;
};

const buildActionSummary = (
  store: ReduxDevToolsStoreRegistration,
  liftedState: ReduxDevToolsLiftedState,
  actionId: number
) => {
  const liftedAction = liftedState.actionsById[actionId];
  const stagedIndex = liftedState.stagedActionIds.indexOf(actionId);
  const computedState = stagedIndex >= 0 ? liftedState.computedStates[stagedIndex] : undefined;

  return {
    instanceId: store.instanceId,
    actionId,
    type: getActionDisplayType(liftedState, actionId),
    liftedType: liftedAction?.type ?? null,
    timestamp: liftedAction?.timestamp ?? null,
    isCurrent: stagedIndex === liftedState.currentStateIndex,
    isSkipped: liftedState.skippedActionIds.includes(actionId),
    hasError: Boolean(computedState?.error),
  };
};

const getVisibleActionIds = (liftedState: ReduxDevToolsLiftedState) => {
  return liftedState.stagedActionIds.filter((actionId) => actionId !== 0).reverse();
};

const getKnownActionIds = (liftedState: ReduxDevToolsLiftedState) => {
  return liftedState.stagedActionIds.filter((actionId) => actionId !== 0);
};

export const buildStoreSummary = (store: ReduxDevToolsStoreRegistration) => {
  const liftedState = store.getLiftedState();

  return {
    instanceId: store.instanceId,
    name: store.name,
    maxAge: store.maxAge,
    actionCount: liftedState ? getKnownActionIds(liftedState).length : 0,
    currentStateIndex: liftedState?.currentStateIndex ?? 0,
    isLocked: liftedState?.isLocked ?? false,
    isPaused: liftedState?.isPaused ?? false,
  };
};

export const resolveReduxDevToolsStore = (instanceId?: string) => {
  const stores = listReduxDevToolsStores();

  if (stores.length === 0) {
    throw new Error('No Redux DevTools stores are registered.');
  }

  if (instanceId) {
    const store = getReduxDevToolsStore(instanceId);
    if (!store) {
      throw new Error(
        `Unknown instanceId "${instanceId}". Available: ${stores.map((item) => item.instanceId).join(', ')}`
      );
    }
    return store;
  }

  if (stores.length > 1) {
    throw new Error(
      `Multiple Redux DevTools stores detected. Provide instanceId. Available: ${stores.map((item) => `${item.name} (${item.instanceId})`).join(', ')}`
    );
  }

  return stores[0];
};

const getStoreAndLiftedState = (instanceId?: string) => {
  const store = resolveReduxDevToolsStore(instanceId);
  const enhancedStore = store.getStore();
  const liftedState = store.getLiftedState();

  if (!enhancedStore || !liftedState) {
    throw new Error(`Redux DevTools store "${store.instanceId}" is not ready yet.`);
  }

  return { store, enhancedStore, liftedState };
};

const assertKnownAction = (
  store: ReduxDevToolsStoreRegistration,
  liftedState: ReduxDevToolsLiftedState,
  actionId: number
) => {
  if (!Number.isInteger(actionId)) {
    throw new Error('actionId must be an integer.');
  }

  if (actionId === 0 || !liftedState.actionsById[actionId]) {
    throw new Error(
      `Unknown actionId "${actionId}" for store "${store.instanceId}". Available: ${getKnownActionIds(liftedState).join(', ')}`
    );
  }
};

const isSerializable = (value: unknown): boolean => {
  if (value == null) {
    return true;
  }

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return Number.isNaN(value as number) ? false : true;
  }

  if (valueType === 'undefined' || valueType === 'function' || valueType === 'symbol') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.every(isSerializable);
  }

  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(isSerializable);
};

export const parseSerializableReduxAction = (action: unknown): AnyAction => {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw new Error('action must be a plain object.');
  }

  if (Object.getPrototypeOf(action) !== Object.prototype) {
    throw new Error('action must be a plain object.');
  }

  if (!('type' in action) || typeof (action as { type?: unknown }).type !== 'string') {
    throw new Error('action.type must be a string.');
  }

  if (!isSerializable(action)) {
    throw new Error('action must be serializable and must not contain functions, symbols, or class instances.');
  }

  return action as AnyAction;
};

export const listReduxDevToolsStoresResult = () => {
  return {
    stores: listReduxDevToolsStores().map(buildStoreSummary),
  };
};

export const getReduxStoreStateResult = ({ instanceId }: StoreInput) => {
  const { store, enhancedStore, liftedState } = getStoreAndLiftedState(instanceId);
  const currentActionId =
    liftedState.stagedActionIds[liftedState.currentStateIndex] ?? null;

  return {
    store: buildStoreSummary(store),
    currentActionId,
    currentAction:
      currentActionId && currentActionId !== 0
        ? buildActionSummary(store, liftedState, currentActionId)
        : null,
    state: serializeForAgent(enhancedStore.getState()),
  };
};

export const listReduxActionsResult = ({
  instanceId,
  offset = 0,
  limit = DEFAULT_PAGE_LIMIT,
}: PaginatedStoreInput) => {
  const { store, liftedState } = getStoreAndLiftedState(instanceId);
  const actionIds = getVisibleActionIds(liftedState);
  const safeOffset = Math.max(0, Math.floor(offset));
  const safeLimit = Math.max(1, Math.floor(limit));
  const selectedIds = actionIds.slice(safeOffset, safeOffset + safeLimit);

  return {
    store: buildStoreSummary(store),
    total: actionIds.length,
    offset: safeOffset,
    limit: safeLimit,
    items: selectedIds.map((actionId) => buildActionSummary(store, liftedState, actionId)),
  };
};

export const getReduxActionDetailsResult = ({ instanceId, actionId }: ActionInput) => {
  const { store, liftedState } = getStoreAndLiftedState(instanceId);
  assertKnownAction(store, liftedState, actionId);

  const stagedIndex = liftedState.stagedActionIds.indexOf(actionId);
  const liftedAction = liftedState.actionsById[actionId];
  const computedState = liftedState.computedStates[stagedIndex];

  return {
    store: buildStoreSummary(store),
    action: buildActionSummary(store, liftedState, actionId),
    liftedAction: serializeForAgent(liftedAction),
    state: serializeForAgent(computedState?.state),
    error: computedState?.error ?? null,
  };
};

export const dispatchReduxActionResult = ({ instanceId, action }: DispatchActionInput) => {
  const { store, enhancedStore } = getStoreAndLiftedState(instanceId);
  const parsedAction = parseSerializableReduxAction(action);
  enhancedStore.dispatch(parsedAction);

  return {
    store: buildStoreSummary(store),
    dispatched: true,
    actionType: parsedAction.type,
  };
};

const runLiftedStoreAction = (
  instanceId: string | undefined,
  actionId: number | undefined,
  createAction: () => unknown
) => {
  const { store, enhancedStore, liftedState } = getStoreAndLiftedState(instanceId);

  if (typeof actionId === 'number') {
    assertKnownAction(store, liftedState, actionId);
  }

  enhancedStore.liftedStore.dispatch(createAction() as never);

  return {
    store: buildStoreSummary(store),
    applied: true,
  };
};

export const jumpToReduxActionResult = ({ instanceId, actionId }: ActionInput) => {
  return runLiftedStoreAction(instanceId, actionId, () =>
    ActionCreators.jumpToAction(actionId)
  );
};

export const toggleReduxActionResult = ({ instanceId, actionId }: ActionInput) => {
  return runLiftedStoreAction(instanceId, actionId, () =>
    ActionCreators.toggleAction(actionId)
  );
};

export const resetReduxHistoryResult = ({ instanceId }: StoreInput) => {
  return runLiftedStoreAction(instanceId, undefined, () => ActionCreators.reset());
};

export const rollbackReduxStateResult = ({ instanceId }: StoreInput) => {
  return runLiftedStoreAction(instanceId, undefined, () => ActionCreators.rollback());
};

export const commitReduxCurrentStateResult = ({ instanceId }: StoreInput) => {
  return runLiftedStoreAction(instanceId, undefined, () => ActionCreators.commit());
};

export const sweepReduxSkippedActionsResult = ({ instanceId }: StoreInput) => {
  return runLiftedStoreAction(instanceId, undefined, () => ActionCreators.sweep());
};

export const setReduxRecordingPausedResult = ({
  instanceId,
  paused,
}: StoreInput & Required<Pick<BooleanStateInput, 'paused'>>) => {
  return runLiftedStoreAction(instanceId, undefined, () =>
    ActionCreators.pauseRecording(paused)
  );
};

export const setReduxLockedResult = ({
  instanceId,
  locked,
}: StoreInput & Required<Pick<BooleanStateInput, 'locked'>>) => {
  return runLiftedStoreAction(instanceId, undefined, () =>
    ActionCreators.lockChanges(locked)
  );
};

export const REDUX_DEVTOOLS_AGENT_TOOLS: AgentTool[] = [
  listStoresTool,
  getStoreStateTool,
  listActionsTool,
  getActionDetailsTool,
  dispatchActionTool,
  jumpToActionTool,
  toggleActionTool,
  resetHistoryTool,
  rollbackStateTool,
  commitCurrentStateTool,
  sweepSkippedActionsTool,
  setRecordingPausedTool,
  setLockedTool,
];

export {
  pluginId as REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
  type ActionInput as ReduxDevToolsActionInput,
  type DispatchActionInput as ReduxDevToolsDispatchActionInput,
  type PaginatedStoreInput as ReduxDevToolsPaginatedStoreInput,
  type StoreInput as ReduxDevToolsStoreInput,
};
