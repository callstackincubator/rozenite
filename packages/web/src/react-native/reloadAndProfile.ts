/**
 * Reload-and-profile config for React DevTools.
 */

import type { ReloadAndProfileConfig } from './storage/session.js';

export type SessionStore = {
	getReloadAndProfileConfig: () => ReloadAndProfileConfig | null;
	setReloadAndProfileConfig: (config: ReloadAndProfileConfig) => void;
}

export type ReloadAndProfileResult = {
	isReloadAndProfileSupported: true;
	isProfiling: boolean;
	profilingSettings: {
		recordChangeDescriptions: boolean;
		recordTimeline: false;
	};
	onReloadAndProfile: (recordChangeDescriptions: boolean) => void;
	onReloadAndProfileFlagsReset: () => void;
}

export const readReloadAndProfileConfig = (
	sessionStore: SessionStore,
): ReloadAndProfileResult => {
	const config = sessionStore.getReloadAndProfileConfig();
	const isProfiling = config?.shouldReloadAndProfile === true;
	const profilingSettings = {
		recordChangeDescriptions: config?.recordChangeDescriptions === true,
		recordTimeline: false as const,
	};
	const onReloadAndProfile = (recordChangeDescriptions: boolean) => {
		sessionStore.setReloadAndProfileConfig({
			shouldReloadAndProfile: true,
			recordChangeDescriptions,
		});
	};
	const onReloadAndProfileFlagsReset = () => {
		sessionStore.setReloadAndProfileConfig({
			shouldReloadAndProfile: false,
			recordChangeDescriptions: false,
		});
	};

	return {
		isReloadAndProfileSupported: true,
		isProfiling,
		profilingSettings,
		onReloadAndProfile,
		onReloadAndProfileFlagsReset,
	};
};
