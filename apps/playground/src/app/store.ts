import { configureStore } from '@reduxjs/toolkit';
import counterReducer from './store/counterSlice';
import { rozeniteDevToolsEnhancer } from '@rozenite/redux-devtools-plugin';

export const store = configureStore({
  reducer: {
    counter: counterReducer,
  },
  enhancers: (getDefaultEnhancers) =>
    getDefaultEnhancers().concat(rozeniteDevToolsEnhancer()),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
