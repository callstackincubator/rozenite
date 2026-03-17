/**
 * This is the entry point for the React Native DevTools integration.
 * It will only be executed in development mode on the web.
 */

const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';

if (__DEV__ && isWeb) {
	const { connectToReactDevTools } = require('./devtools.js') as typeof import('./devtools.js');
	connectToReactDevTools();

	console.log('[Rozenite] Rozenite for Web loaded successfully.');
}