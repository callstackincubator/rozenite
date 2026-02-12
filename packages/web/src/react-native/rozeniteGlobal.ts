/**
 * Rozenite global configuration for React DevTools.
 */

declare global {
	var __ROZENITE_WEB__: {
		appDisplayName: string;
		reactNativeVersion: string;
	};
}

const reactNativePackage = require('react-native/package.json') as { version: string };

export const defineRozeniteGlobal = () => {
	globalThis.__ROZENITE_WEB__ = {
		appDisplayName: '',
		reactNativeVersion: reactNativePackage.version,
	};
};