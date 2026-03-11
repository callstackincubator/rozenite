import { useEffect, useMemo } from 'react';
import { Provider } from 'react-redux';
import type { Store } from 'redux';
import { Persistor } from 'redux-persist';
import { PersistGate } from 'redux-persist/integration/react';
import {
  App,
  UPDATE_STATE,
  showNotification,
  type Request,
} from '@redux-devtools/app-core';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import configureStore, {
  setReduxDevToolsCommandSender,
  type ReduxDevToolsStoreAction,
  type ReduxDevToolsStoreState,
} from './store';
import type {
  ReduxDevToolsBridgeEventMap,
  ReduxDevToolsRuntimeMessage,
} from '../shared/protocol';

type StoreBundle = {
  store: Store<ReduxDevToolsStoreState, ReduxDevToolsStoreAction>;
  persistor: Persistor;
};

const handleRuntimeMessage = (
  store: Store<ReduxDevToolsStoreState, ReduxDevToolsStoreAction>,
  message: ReduxDevToolsRuntimeMessage
) => {
  switch (message.type) {
    case 'state-update': {
      store.dispatch({
        type: UPDATE_STATE,
        request: message.request as unknown as Request,
        id: message.connectionId,
      } as ReduxDevToolsStoreAction);
      return;
    }
    case 'error': {
      store.dispatch(showNotification(message.message) as ReduxDevToolsStoreAction);
      return;
    }
    default:
      return;
  }
};

export const ReduxDevTools = () => {
  const client = useRozeniteDevToolsClient<ReduxDevToolsBridgeEventMap>({
    pluginId: '@rozenite/redux-devtools-plugin',
  });

  const bundle = useMemo<StoreBundle>(() => {
    return configureStore(() => {
      // no-op
    });
  }, []);

  useEffect(() => {
    if (!client) {
      setReduxDevToolsCommandSender(null);
      return;
    }

    setReduxDevToolsCommandSender((command) => {
      client.send('panel-command', command);
    });

    const subscription = client.onMessage(
      'runtime-message',
      (message: ReduxDevToolsRuntimeMessage) => {
      handleRuntimeMessage(bundle.store, message);
      }
    );

    client.send('panel-command', { type: 'start' });
    client.send('panel-command', { type: 'request-state' });

    return () => {
      subscription.remove();
      setReduxDevToolsCommandSender(null);
    };
  }, [bundle.store, client]);

  return (
    <Provider store={bundle.store}>
      <PersistGate loading={null} persistor={bundle.persistor}>
        <App />
      </PersistGate>
    </Provider>
  );
};
