import {
  coreReducers,
  middlewares,
  type CoreStoreAction,
  type CoreStoreState,
  type LiftedActionAction,
  LIFTED_ACTION,
  getActiveInstance,
} from '@redux-devtools/app-core';
import {
  createStore,
  compose,
  applyMiddleware,
  combineReducers,
  type Reducer,
  type Store,
  type Middleware,
} from 'redux';
import localForage from 'localforage';
import { persistReducer, persistStore } from 'redux-persist';
import type { ReduxDevToolsPanelCommand } from '../shared/protocol';

export type ReduxDevToolsStoreState = CoreStoreState;
export type ReduxDevToolsStoreAction = CoreStoreAction;

type CommandSender = (command: ReduxDevToolsPanelCommand) => void;

let commandSender: CommandSender | null = null;

export const setReduxDevToolsCommandSender = (sender: CommandSender | null) => {
  commandSender = sender;
};

const bridgeMiddleware: Middleware<object, ReduxDevToolsStoreState> =
  (storeApi) => (next) => (action) => {
    const result = next(action);

    if (!commandSender) {
      return result;
    }

    const typedAction = action as ReduxDevToolsStoreAction;

    if (typedAction.type !== LIFTED_ACTION) {
      return result;
    }

    const lifted = typedAction as LiftedActionAction;
    const state = storeApi.getState();
    const instanceId = String(getActiveInstance(state.instances));

    switch (lifted.message) {
      case 'DISPATCH': {
        if (!('action' in lifted) || !lifted.action) {
          return result;
        }

        commandSender({
          type: 'dispatch',
          action: lifted.action,
          instanceId,
          toAll: lifted.toAll,
        });

        return result;
      }
      case 'ACTION': {
        if (!('action' in lifted) || !lifted.action) {
          return result;
        }

        commandSender({
          type: 'action',
          action: lifted.action,
          instanceId,
        });

        return result;
      }
      case 'IMPORT': {
        if (!('state' in lifted) || typeof lifted.state !== 'string') {
          return result;
        }

        commandSender({
          type: 'import-state',
          state: lifted.state,
          instanceId,
        });

        return result;
      }
      default:
        return result;
    }
  };

const persistConfig = {
  key: 'redux-devtools',
  blacklist: ['instances'],
  storage: localForage,
};

const rootReducer = combineReducers(coreReducers);

const persistedReducer: Reducer<ReduxDevToolsStoreState, ReduxDevToolsStoreAction> =
  persistReducer(
    persistConfig,
    rootReducer as unknown as Reducer<
      ReduxDevToolsStoreState,
      ReduxDevToolsStoreAction
    >
  ) as any;

export default function configureStore(
  callback: (store: Store<ReduxDevToolsStoreState, ReduxDevToolsStoreAction>) => void
) {
  let composeEnhancers = compose;

  if (process.env.NODE_ENV !== 'production') {
    const devtoolsCompose = (
      window as unknown as {
        __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
      }
    ).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;

    if (devtoolsCompose) {
      composeEnhancers = devtoolsCompose;
    }
  }

  const store = createStore(
    persistedReducer,
    composeEnhancers(applyMiddleware(...middlewares, bridgeMiddleware))
  );

  const persistor = persistStore(store as Store, null, () => {
    callback(store);
  });

  return { store, persistor };
}
