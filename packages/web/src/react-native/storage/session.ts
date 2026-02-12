/**
 * Session storage for React DevTools reload-and-profile config (sessionStorage).
 */
/// <reference lib="dom" />

const RELOAD_AND_PROFILE_CONFIG = 'ReactDevTools::ReloadAndProfileConfig';

export interface ReloadAndProfileConfig {
	shouldReloadAndProfile?: boolean;
	recordChangeDescriptions?: boolean;
}

export const setReloadAndProfileConfig = (config: ReloadAndProfileConfig): void => {
	try {
		sessionStorage.setItem(RELOAD_AND_PROFILE_CONFIG, JSON.stringify(config));
	} catch (e) {
		console.warn('Failed to persist reload-and-profile config:', e);
	}
};

export const getReloadAndProfileConfig = (): ReloadAndProfileConfig | null => {
	const value = sessionStorage.getItem(RELOAD_AND_PROFILE_CONFIG);

	if (typeof value !== 'string') {
		return null;
	}

	try {
		return JSON.parse(value);
	} catch {
		console.warn('Failed to parse reload-and-profile config. Returning null.');
		return null;
	}
};
