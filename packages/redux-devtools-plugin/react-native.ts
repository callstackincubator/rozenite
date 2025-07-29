export let rozeniteDevToolsEnhancer: typeof import('./src/runtime').rozeniteDevToolsEnhancer;

if (process.env.NODE_ENV !== 'production') {
  rozeniteDevToolsEnhancer = require('./src/runtime').rozeniteDevToolsEnhancer;
} else {
  rozeniteDevToolsEnhancer =
    () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createStore: (...args: any[]) => any) =>
    (...args) =>
      createStore(...args);
}
