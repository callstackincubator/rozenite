/**
 * This is the entry point for the React Native DevTools integration.
 * It will only be executed in development mode on the web.
 */

import { connectToReactDevTools } from './devtools.js';

const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';

if (__DEV__ && isWeb) {
	connectToReactDevTools();
}