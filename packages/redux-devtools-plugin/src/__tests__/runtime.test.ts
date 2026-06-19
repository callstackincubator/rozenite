import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionCreators } from '@redux-devtools/instrument';
// @ts-expect-error app-core does not publish declarations for built subpaths.
import { UPDATE_STATE } from '@redux-devtools/app-core/lib/esm/constants/actionTypes.js';
// @ts-expect-error app-core does not publish declarations for built subpaths.
import { instances as reduceInstances } from '@redux-devtools/app-core/lib/esm/reducers/instances.js';
import { parse } from 'jsan';
import { createStore, type Action } from 'redux';
import { rozeniteDevToolsEnhancer } from '../runtime';
import { getReduxActionDetailsResult } from '../redux-devtools-agent';
import { clearReduxDevToolsStoreRegistryForTests } from '../redux-devtools-registry';
import type {
  ReduxDevToolsPanelCommand,
  ReduxDevToolsRuntimeMessage,
} from '../shared/protocol';

const bridge = vi.hoisted(() => ({
  panelCommandListener: undefined as
    | ((command: ReduxDevToolsPanelCommand) => void)
    | undefined,
  sentMessages: [] as ReduxDevToolsRuntimeMessage[],
}));

vi.mock('../runtime-bridge', () => ({
  getRuntimeConnectionId: () => 'test-connection',
  sendRuntimeMessage: (message: ReduxDevToolsRuntimeMessage) => {
    bridge.sentMessages.push(message);
  },
  subscribeToPanelCommands: (
    listener: (command: ReduxDevToolsPanelCommand) => void
  ) => {
    bridge.panelCommandListener = listener;

    return () => {
      if (bridge.panelCommandListener === listener) {
        bridge.panelCommandListener = undefined;
      }
    };
  },
}));

vi.mock('react-native', () => ({
  NativeModules: {
    SourceCode: {
      scriptURL: undefined,
    },
  },
}));

type TestState = {
  counter: number;
  largeValue: string;
};

type TestAction = Action<string> & {
  payload?: number;
  largeValue?: string;
};

const initialState: TestState = {
  counter: 0,
  largeValue: 'initial-large-value',
};

const reducer = (
  state: TestState = initialState,
  action: TestAction
): TestState => {
  if (action.type === 'counter/add') {
    return {
      counter: state.counter + (action.payload ?? 0),
      largeValue: action.largeValue ?? state.largeValue,
    };
  }

  return state;
};

const setupRuntime = async () => {
  vi.resetModules();
  bridge.sentMessages.length = 0;
  bridge.panelCommandListener = undefined;

  const runtime = await import('../runtime');

  const sendPanelCommand = (command: ReduxDevToolsPanelCommand) => {
    if (!bridge.panelCommandListener) {
      throw new Error('Panel command listener was not registered.');
    }

    bridge.panelCommandListener(command);
  };

  return {
    ...runtime,
    sentMessages: bridge.sentMessages,
    sendPanelCommand,
  };
};

const getStateUpdateRequests = (messages: ReduxDevToolsRuntimeMessage[]) => {
  return messages
    .filter((message) => message.type === 'state-update')
    .map((message) => message.request);
};

afterEach(() => {
  clearReduxDevToolsStoreRegistryForTests();
  bridge.panelCommandListener = undefined;
  bridge.sentMessages.length = 0;
  vi.resetModules();
});

describe('redux devtools runtime', () => {
  it('streams sanitized lifted state snapshots through PARTIAL_STATE', async () => {
    const {
      rozeniteDevToolsEnhancer,
      sentMessages,
      sendPanelCommand,
    } = await setupRuntime();

    const store = createStore(
      reducer,
      rozeniteDevToolsEnhancer({
        stateSanitizer: (state) => ({
          counter: (state as TestState).counter,
        }),
        actionSanitizer: (action) => ({
          type: (action as TestAction).type,
        }),
      })
    );

    store.dispatch({
      type: 'counter/add',
      payload: 1,
      largeValue: 'action-large-value',
    });

    sendPanelCommand({ type: 'start' });

    const requests = getStateUpdateRequests(sentMessages);
    expect(requests.map((request) => request.type)).toEqual([
      'STATE',
      'PARTIAL_STATE',
    ]);

    const initialPayload = parse(requests[0].payload) as {
      computedStates: Array<{ state: unknown }>;
    };
    const partialPayload = parse(requests[1].payload) as {
      actionsById: Record<number, { action: unknown }>;
      computedStates: Array<{ state: unknown }>;
    };

    expect(initialPayload.computedStates[0].state).toEqual({ counter: 0 });
    expect(partialPayload.computedStates[0].state).toEqual({ counter: 1 });
    expect(partialPayload.actionsById[1].action).toEqual({
      type: 'counter/add',
    });
  });

  it('sanitizes live action updates after monitoring starts', async () => {
    const {
      rozeniteDevToolsEnhancer,
      sentMessages,
      sendPanelCommand,
    } = await setupRuntime();

    const store = createStore(
      reducer,
      rozeniteDevToolsEnhancer({
        stateSanitizer: (state) => ({
          counter: (state as TestState).counter,
        }),
        actionSanitizer: (action) => ({
          type: (action as TestAction).type,
        }),
      })
    );

    sendPanelCommand({ type: 'start' });
    sentMessages.length = 0;

    store.dispatch({
      type: 'counter/add',
      payload: 2,
      largeValue: 'action-large-value',
    });

    const requests = getStateUpdateRequests(sentMessages);
    expect(requests).toHaveLength(1);
    expect(requests[0].type).toBe('ACTION');

    if (requests[0].type !== 'ACTION') {
      throw new Error('Expected ACTION request.');
    }

    expect(parse(requests[0].payload)).toEqual({ counter: 2 });
    expect(parse(requests[0].action)).toEqual({
      type: 'PERFORM_ACTION',
      action: {
        type: 'counter/add',
      },
      timestamp: expect.any(Number),
    });
  });

  it('reconstructs maxAge-trimmed history in the Redux DevTools reducer', async () => {
    const {
      rozeniteDevToolsEnhancer,
      sentMessages,
      sendPanelCommand,
    } = await setupRuntime();

    const store = createStore(
      reducer,
      rozeniteDevToolsEnhancer({
        maxAge: 2,
        stateSanitizer: (state) => ({
          counter: (state as TestState).counter,
        }),
        actionSanitizer: (action) => ({
          type: action.type,
        }),
      })
    );

    store.dispatch({ type: 'counter/add', payload: 1 });
    store.dispatch({ type: 'counter/add', payload: 1 });
    store.dispatch({ type: 'counter/add', payload: 1 });

    sendPanelCommand({ type: 'start' });

    const requests = getStateUpdateRequests(sentMessages);
    const state = requests.reduce(
      (nextState, request) =>
        reduceInstances(nextState, {
          type: UPDATE_STATE,
          request: request as never,
          id: 'test-connection',
        }),
      undefined as Parameters<typeof reduceInstances>[0] | undefined
    );

    if (!state) {
      throw new Error('Expected Redux DevTools instances state.');
    }

    const instanceState = state.states[requests[0].instanceId];

    expect(requests.map((request) => request.type)).toEqual([
      'STATE',
      'PARTIAL_STATE',
    ]);
    expect(instanceState.committedState).toEqual({ counter: 2 });
    expect(
      instanceState.computedStates.map(
        (entry: { state: unknown }) => entry.state
      )
    ).toEqual([{ counter: 2 }, { counter: 3 }]);
    expect(instanceState.currentStateIndex).toBe(1);
  });
});

describe('redux devtools runtime tracing', () => {
  it('drops traces for actions removed from lifted history', () => {
    const store = createStore(
      reducer,
      rozeniteDevToolsEnhancer({
        maxAge: 2,
        trace: (action) =>
          `Error\n    at ${action.type} (http://localhost:8081/index.bundle:1:1)`,
        traceSymbolication: false,
      })
    );

    bridge.panelCommandListener?.({ type: 'start' });

    store.dispatch({ type: 'counter/increment' });
    expect(getReduxActionDetailsResult({ actionId: 1 }).trace).toEqual(
      expect.objectContaining({
        rawStack: expect.stringContaining('counter/increment'),
      })
    );

    (
      store as typeof store & {
        liftedStore: { dispatch: (action: unknown) => unknown };
      }
    ).liftedStore.dispatch(ActionCreators.commit());
    store.dispatch({ type: 'counter/decrement' });

    expect(getReduxActionDetailsResult({ actionId: 1 }).trace).toEqual(
      expect.objectContaining({
        rawStack: expect.stringContaining('counter/decrement'),
      })
    );
  });
});
