import { ActionCreators } from '@redux-devtools/instrument';
import type { Action } from 'redux';
import { parse, stringify } from 'jsan';
import {
  getReduxDevToolsStore,
  listReduxDevToolsStores,
  type ReduxDevToolsLiftedState,
  type ReduxDevToolsStoreRegistration,
} from './redux-devtools-registry';
import {
  REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
  reduxDevToolsToolDefinitions,
  type ReduxDevToolsActionInput as ActionInput,
  type ReduxDevToolsApplyStoreActionResult,
  type ReduxDevToolsDispatchActionInput as DispatchActionInput,
  type ReduxDevToolsDispatchActionResult,
  type ReduxDevToolsGetActionDetailsResult,
  type ReduxDevToolsGetStoreStateResult,
  type ReduxDevToolsListActionsResult,
  type ReduxDevToolsListStoresResult,
  type ReduxDevToolsPaginatedStoreInput as PaginatedStoreInput,
  type ReduxDevToolsSetLockedInput,
  type ReduxDevToolsSetRecordingPausedInput,
  type ReduxDevToolsStoreInput as StoreInput,
  type ReduxDevToolsStoreSummary,
} from './shared/agent-tools';

type AnyAction = Action<string> & Record<string, unknown>;
const DEFAULT_PAGE_LIMIT = 50;
export const listStoresTool = reduxDevToolsToolDefinitions.listStores;
export const getStoreStateTool = reduxDevToolsToolDefinitions.getStoreState;
export const listActionsTool = reduxDevToolsToolDefinitions.listActions;
export const getActionDetailsTool =
  reduxDevToolsToolDefinitions.getActionDetails;
export const dispatchActionTool = reduxDevToolsToolDefinitions.dispatchAction;
export const jumpToActionTool = reduxDevToolsToolDefinitions.jumpToAction;
export const toggleActionTool = reduxDevToolsToolDefinitions.toggleAction;
export const resetHistoryTool = reduxDevToolsToolDefinitions.resetHistory;
export const rollbackStateTool = reduxDevToolsToolDefinitions.rollbackState;
export const commitCurrentStateTool =
  reduxDevToolsToolDefinitions.commitCurrentState;
export const sweepSkippedActionsTool =
  reduxDevToolsToolDefinitions.sweepSkippedActions;
export const setRecordingPausedTool =
  reduxDevToolsToolDefinitions.setRecordingPaused;
export const setLockedTool = reduxDevToolsToolDefinitions.setLocked;

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

export const buildStoreSummary = (
  store: ReduxDevToolsStoreRegistration
): ReduxDevToolsStoreSummary => {
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

export const listReduxDevToolsStoresResult =
  (): ReduxDevToolsListStoresResult => {
  return {
    stores: listReduxDevToolsStores().map(buildStoreSummary),
  };
};

export const getReduxStoreStateResult = ({
  instanceId,
}: StoreInput): ReduxDevToolsGetStoreStateResult => {
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
}: PaginatedStoreInput): ReduxDevToolsListActionsResult => {
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

export const getReduxActionDetailsResult = ({
  instanceId,
  actionId,
}: ActionInput): ReduxDevToolsGetActionDetailsResult => {
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

export const dispatchReduxActionResult = ({
  instanceId,
  action,
}: DispatchActionInput): ReduxDevToolsDispatchActionResult => {
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
): ReduxDevToolsApplyStoreActionResult => {
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
}: ReduxDevToolsSetRecordingPausedInput) => {
  return runLiftedStoreAction(instanceId, undefined, () =>
    ActionCreators.pauseRecording(paused)
  );
};

export const setReduxLockedResult = ({
  instanceId,
  locked,
}: ReduxDevToolsSetLockedInput) => {
  return runLiftedStoreAction(instanceId, undefined, () =>
    ActionCreators.lockChanges(locked)
  );
};

export const REDUX_DEVTOOLS_AGENT_TOOLS = Object.values(
  reduxDevToolsToolDefinitions,
);
