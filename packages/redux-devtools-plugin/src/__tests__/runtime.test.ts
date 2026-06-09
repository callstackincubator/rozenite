import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionCreators } from '@redux-devtools/instrument';
import { createStore, type Action } from 'redux';
import { rozeniteDevToolsEnhancer } from '../runtime';
import { getReduxActionDetailsResult } from '../redux-devtools-agent';
import { clearReduxDevToolsStoreRegistryForTests } from '../redux-devtools-registry';
import type { ReduxDevToolsPanelCommand } from '../shared/protocol';

const bridge = vi.hoisted(() => ({
  panelCommandListener: undefined as
    | ((command: ReduxDevToolsPanelCommand) => void)
    | undefined,
}));

vi.mock('../runtime-bridge', () => ({
  getRuntimeConnectionId: () => 'test-connection',
  sendRuntimeMessage: vi.fn(),
  subscribeToPanelCommands: vi.fn(
    (listener: (command: ReduxDevToolsPanelCommand) => void) => {
      bridge.panelCommandListener = listener;

      return vi.fn();
    }
  ),
}));

vi.mock('react-native', () => ({
  NativeModules: {
    SourceCode: {
      scriptURL: undefined,
    },
  },
}));

type CounterAction = Action<string>;

const reducer = (state = 0, action: CounterAction) => {
  switch (action.type) {
    case 'counter/increment':
      return state + 1;
    case 'counter/decrement':
      return state - 1;
    default:
      return state;
  }
};

afterEach(() => {
  clearReduxDevToolsStoreRegistryForTests();
  bridge.panelCommandListener = undefined;
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
