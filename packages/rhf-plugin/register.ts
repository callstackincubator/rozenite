// Production entry point (`@rozenite/rhf-plugin/register`).
//
// `useRozeniteRHFPlugin` takes the `control`/`reset` of one specific
// `useForm()` instance, so it is called once per form inside ordinary screen
// components - it cannot be hoisted to a single dev-entry mount point, so
// this touchpoint is declared safe via `productionEntries` in
// `rozenite.config.ts`. Import from the underlying `src/**` modules
// directly, never from `./react-native.ts`: that shim pulls in the plugin's
// whole dev surface, which is exactly what this entry point exists to keep
// out of the production bundle.
export { useRozeniteRHFPlugin } from './src/react-native/useRozeniteRHFPlugin';
export type { UseRozeniteRHFPluginOptions } from './src/react-native/useRozeniteRHFPlugin';
export type { FieldError, FormSnapshot } from './src/shared/types';
