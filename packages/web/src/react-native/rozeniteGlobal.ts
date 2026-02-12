/**
 * Rozenite global configuration for React DevTools.
 */

declare global {
	var __ROZENITE_WEB__: {
		appDisplayName: string;
		reactNativeVersion: string;
	};
}

import reactNativePackage from 'react-native/package.json' with { type: 'json' };

export const defineRozeniteGlobal = () => {
	globalThis.__ROZENITE_WEB__ = {
		appDisplayName: '',
		reactNativeVersion: reactNativePackage.version,
	};
};