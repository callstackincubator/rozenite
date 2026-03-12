import 'react-native-get-random-values';

import { configureStore } from '@reduxjs/toolkit';
import counterReducer from './store/counterSlice';
import { rozeniteDevToolsEnhancer } from '@rozenite/redux-devtools-plugin';

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
        })
      ),
  });

export const primaryStore = createCounterStore('playground-primary-counter');
export const secondaryStore = createCounterStore('playground-secondary-counter');

export type RootState = ReturnType<typeof primaryStore.getState>;
export type AppDispatch = typeof primaryStore.dispatch;
