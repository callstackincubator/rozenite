import 'react-native-get-random-values';

import { configureStore } from '@reduxjs/toolkit';
import counterReducer from './store/counterSlice';
// This store is real app state created at module scope, so it needs the
// enhancer at production runtime — `/register` is the declared production
// entry that the build-time guard permits from ordinary app code.
import { rozeniteDevToolsEnhancer } from '@rozenite/redux-devtools-plugin/register';

const createCounterStore = (name: string) =>
  configureStore({
    reducer: {
      counter: counterReducer,
    },
    enhancers: (getDefaultEnhancers) =>
      getDefaultEnhancers().concat(
        rozeniteDevToolsEnhancer({
          name,
          maxAge: 150,
          trace: true,
        }),
      ),
  });

export const primaryStore = createCounterStore('playground-primary-counter');
export const secondaryStore = createCounterStore('playground-secondary-counter');

export type RootState = ReturnType<typeof primaryStore.getState>;
export type AppDispatch = typeof primaryStore.dispatch;
