// Production entry point (`@rozenite/redux-devtools-plugin/register`).
//
// A store enhancer is applied where the store is created, which is ordinary
// app code that runs in production - so this touchpoint is declared safe via
// `productionEntries` in `rozenite.config.ts`. Import from the underlying
// `src/**` modules directly, never from `./react-native.ts`: that shim pulls
// in the plugin's whole dev surface, which is exactly what this entry point
// exists to keep out of the production bundle.
export { rozeniteDevToolsEnhancer, composeWithRozeniteDevTools } from './src/runtime';
export type { RozeniteDevToolsOptions } from './src/runtime';
