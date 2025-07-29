import { Component } from 'react';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import { Persistor } from 'redux-persist';
import { PersistGate } from 'redux-persist/integration/react';
import {
  App,
  StoreState,
  StoreAction,
  saveSocketSettings,
} from '@redux-devtools/app';
import configureStore from './store';
import { REDUX_DEVTOOLS_PORT } from '../constants';

export class ReduxDevTools extends Component {
  store?: Store<StoreState, StoreAction>;
  persistor?: Persistor;

  UNSAFE_componentWillMount() {
    const { store, persistor } = configureStore(
      (store: Store<StoreState, StoreAction>) => {
        store.dispatch(
          saveSocketSettings({
            type: 'custom',
            hostname: 'localhost',
            port: REDUX_DEVTOOLS_PORT,
            secure: false,
          })
        );
      }
    );
    this.store = store;
    this.persistor = persistor;
  }

  render() {
    if (!this.store || !this.persistor) {
      return null;
    }

    return (
      <Provider store={this.store}>
        <PersistGate loading={null} persistor={this.persistor}>
          <App />
        </PersistGate>
      </Provider>
    );
  }
}
