/**
 * Fusebox connection management for React DevTools.
 */

import type { ReloadAndProfileResult, SessionStore } from './reloadAndProfile.js';
import type { FuseboxDomain } from './types.js';

export type FuseboxConnectionDeps = {
	sessionStore: SessionStore;
	ReactNativeStyleAttributes: Record<string, unknown>;
	resolveRNStyle: (style: unknown) => unknown;
	connectWithCustomMessagingProtocol: (options: {
		onSubscribe: (listener: (event: unknown) => void) => void;
		onUnsubscribe: (listener: (event: unknown) => void) => void;
		onMessage: (event: unknown, payload: unknown) => void;
		nativeStyleEditorValidAttributes: string[];
		resolveRNStyle: (style: unknown) => unknown;
		onSettingsUpdated: (settings: unknown) => void;
		isReloadAndProfileSupported: boolean;
		isProfiling: boolean;
		onReloadAndProfile: (recordChangeDescriptions: boolean) => void;
		onReloadAndProfileFlagsReset: () => void;
	}) => () => void;
	savePersistedHookSettings: (settings: unknown) => void;
	readReloadAndProfileConfig: (sessionStore: SessionStore) => ReloadAndProfileResult;
}

export const createFuseboxConnection = (deps: FuseboxConnectionDeps) => {
	const {
		sessionStore,
		ReactNativeStyleAttributes,
		resolveRNStyle,
		connectWithCustomMessagingProtocol,
		savePersistedHookSettings,
		readReloadAndProfileConfig,
	} = deps;

	let disconnect: (() => void) | null = null;

	const disconnectIfNeeded = () => {
		if (disconnect != null) {
			disconnect();
			disconnect = null;
		}
	};

	const handleSettingsUpdate = (settings: unknown) => {
		savePersistedHookSettings(settings);
	};

	const connect = async (domain: FuseboxDomain) => {
		const {
			isReloadAndProfileSupported,
			isProfiling,
			onReloadAndProfile,
			onReloadAndProfileFlagsReset,
		} = readReloadAndProfileConfig(sessionStore);

		// It looks like there is a difference in event loop behavior between native and web.
		// There is no need to wait for the next tick on native,
		// but on web, some messages will be not processed if we don't wait for the next tick.
		await new Promise((resolve) => setTimeout(resolve));

		disconnect = connectWithCustomMessagingProtocol({
			onSubscribe: (listener) => {
				domain.onMessage.addEventListener(listener);
			},
			onUnsubscribe: (listener) => {
				domain.onMessage.removeEventListener(listener);
			},
			onMessage: (event, payload) => {
				domain.sendMessage({ event, payload });
			},
			nativeStyleEditorValidAttributes: Object.keys(ReactNativeStyleAttributes),
			resolveRNStyle,
			onSettingsUpdated: handleSettingsUpdate,
			isReloadAndProfileSupported,
			isProfiling,
			onReloadAndProfile,
			onReloadAndProfileFlagsReset,
		});
	};

	return { connect, disconnectIfNeeded };
};
