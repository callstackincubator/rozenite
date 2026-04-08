import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionCreators } from '@redux-devtools/instrument';
import {
  buildStoreSummary,
  commitReduxCurrentStateResult,
  dispatchReduxActionResult,
  getReduxActionDetailsResult,
  getReduxStoreStateResult,
  jumpToReduxActionResult,
  listReduxActionsResult,
  listReduxDevToolsStoresResult,
  resolveReduxDevToolsStore,
  resetReduxHistoryResult,
  rollbackReduxStateResult,
  setReduxLockedResult,
  setReduxRecordingPausedResult,
  sweepReduxSkippedActionsResult,
  toggleReduxActionResult,
  parseSerializableReduxAction,
} from '../redux-devtools-agent';
import {
  clearReduxDevToolsStoreRegistryForTests,
  registerReduxDevToolsStore,
  type ReduxDevToolsEnhancedStore,
  type ReduxDevToolsLiftedState,
} from '../redux-devtools-registry';

const createLiftedState = (
  overrides: Partial<ReduxDevToolsLiftedState> = {}
): ReduxDevToolsLiftedState => {
  const initAction = ActionCreators.performAction({ type: '@@INIT' });
  const incrementAction = ActionCreators.performAction({
    type: 'counter/increment',
    payload: 1,
  });
  const decrementAction = ActionCreators.performAction({
    type: 'counter/decrement',
    payload: 1,
  });

  return {
    monitorState: null,
    nextActionId: 3,
    actionsById: {
      0: initAction,
      1: incrementAction,
      2: decrementAction,
    },
    stagedActionIds: [0, 1, 2],
    skippedActionIds: [],
    committedState: { count: 0 },
    currentStateIndex: 2,
    computedStates: [
      { state: { count: 0 } },
      { state: { count: 1 } },
      { state: { count: 0 } },
    ],
    isLocked: false,
    isPaused: false,
    ...overrides,
  };
};

const registerStore = ({
  instanceId = 'store-1',
  name = 'App Store',
  maxAge = 50,
  liftedState = createLiftedState(),
  currentState = { count: 0 },
} = {}) => {
  const dispatch = vi.fn();
  const liftedDispatch = vi.fn();
  const store = {
    getState: vi.fn(() => currentState),
    dispatch,
    liftedStore: {
      dispatch: liftedDispatch,
    },
  } as unknown as ReduxDevToolsEnhancedStore;

  registerReduxDevToolsStore({
    instanceId,
    name,
    maxAge,
    getStore: () => store,
    getLiftedState: () => liftedState,
  });

  return { store, dispatch, liftedDispatch, liftedState };
};

afterEach(() => {
  clearReduxDevToolsStoreRegistryForTests();
});

describe('redux devtools agent helpers', () => {
  it('lists stores with derived status', () => {
    registerStore({
      liftedState: createLiftedState({
        isLocked: true,
        isPaused: true,
      }),
    });

    expect(listReduxDevToolsStoresResult()).toEqual({
      stores: [
        {
          instanceId: 'store-1',
          name: 'App Store',
          maxAge: 50,
          actionCount: 2,
          currentStateIndex: 2,
          isLocked: true,
          isPaused: true,
        },
      ],
    });
  });

  it('requires instanceId when multiple stores are registered', () => {
    registerStore({ instanceId: 'store-1', name: 'One' });
    registerStore({ instanceId: 'store-2', name: 'Two' });

    expect(() => resolveReduxDevToolsStore()).toThrow(
      'Multiple Redux DevTools stores detected.'
    );
    expect(resolveReduxDevToolsStore('store-2').name).toBe('Two');
  });

  it('returns current store state and metadata', () => {
    registerStore();

    expect(getReduxStoreStateResult({})).toEqual({
      store: buildStoreSummary(resolveReduxDevToolsStore()),
      currentActionId: 2,
      currentAction: {
        instanceId: 'store-1',
        actionId: 2,
        type: 'counter/decrement',
        liftedType: 'PERFORM_ACTION',
        timestamp: expect.any(Number),
        isCurrent: true,
        isSkipped: false,
        hasError: false,
      },
      state: { count: 0 },
    });
  });

  it('lists actions newest first with pagination', () => {
    registerStore({
      liftedState: createLiftedState({
        skippedActionIds: [1],
      }),
    });

    expect(listReduxActionsResult({ limit: 1 })).toEqual({
      store: {
        instanceId: 'store-1',
        name: 'App Store',
        maxAge: 50,
        actionCount: 2,
        currentStateIndex: 2,
        isLocked: false,
        isPaused: false,
      },
      total: 2,
      offset: 0,
      limit: 1,
      items: [
        {
          instanceId: 'store-1',
          actionId: 2,
          type: 'counter/decrement',
          liftedType: 'PERFORM_ACTION',
          timestamp: expect.any(Number),
          isCurrent: true,
          isSkipped: false,
          hasError: false,
        },
      ],
    });
  });

  it('returns action details with computed state', () => {
    registerStore();

    expect(getReduxActionDetailsResult({ actionId: 1 })).toEqual({
      store: {
        instanceId: 'store-1',
        name: 'App Store',
        maxAge: 50,
        actionCount: 2,
        currentStateIndex: 2,
        isLocked: false,
        isPaused: false,
      },
      action: {
        instanceId: 'store-1',
        actionId: 1,
        type: 'counter/increment',
        liftedType: 'PERFORM_ACTION',
        timestamp: expect.any(Number),
        isCurrent: false,
        isSkipped: false,
        hasError: false,
      },
      liftedAction: {
        type: 'PERFORM_ACTION',
        action: {
          type: 'counter/increment',
          payload: 1,
        },
        timestamp: expect.any(Number),
        stack: undefined,
      },
      state: { count: 1 },
      error: null,
    });
  });

  it('dispatches a normal Redux action through the real store', () => {
    const { dispatch } = registerStore();
    const action = { type: 'counter/increment', payload: 1 };

    expect(dispatchReduxActionResult({ action })).toEqual({
      store: {
        instanceId: 'store-1',
        name: 'App Store',
        maxAge: 50,
        actionCount: 2,
        currentStateIndex: 2,
        isLocked: false,
        isPaused: false,
      },
      dispatched: true,
      actionType: 'counter/increment',
    });
    expect(dispatch).toHaveBeenCalledWith(action);
  });

  it('rejects non-serializable actions', () => {
    expect(() =>
      parseSerializableReduxAction({
        type: 'counter/increment',
        callback: () => undefined,
      })
    ).toThrow('action must be serializable');
  });

  it('dispatches lifted history actions for agent mutations', () => {
    const { liftedDispatch } = registerStore();

    jumpToReduxActionResult({ actionId: 2 });
    toggleReduxActionResult({ actionId: 1 });
    resetReduxHistoryResult({});
    rollbackReduxStateResult({});
    commitReduxCurrentStateResult({});
    sweepReduxSkippedActionsResult({});
    setReduxRecordingPausedResult({ paused: true });
    setReduxLockedResult({ locked: true });

    expect(liftedDispatch).toHaveBeenNthCalledWith(
      1,
      ActionCreators.jumpToAction(2)
    );
    expect(liftedDispatch).toHaveBeenNthCalledWith(
      2,
      ActionCreators.toggleAction(1)
    );
    expect(liftedDispatch).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ type: 'RESET' })
    );
    expect(liftedDispatch).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ type: 'ROLLBACK' })
    );
    expect(liftedDispatch).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ type: 'COMMIT' })
    );
    expect(liftedDispatch).toHaveBeenNthCalledWith(6, ActionCreators.sweep());
    expect(liftedDispatch).toHaveBeenNthCalledWith(
      7,
      ActionCreators.pauseRecording(true)
    );
    expect(liftedDispatch).toHaveBeenNthCalledWith(
      8,
      ActionCreators.lockChanges(true)
    );
  });
});
