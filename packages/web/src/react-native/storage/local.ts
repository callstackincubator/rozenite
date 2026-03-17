/**
 * Local storage for React DevTools hook settings (localStorage).
 */
/// <reference lib="dom" />

const GLOBAL_HOOK_SETTINGS = 'ReactDevTools::HookSettings';

export const loadPersistedHookSettings = (): unknown => {
	const value = localStorage.getItem(GLOBAL_HOOK_SETTINGS);

	if (typeof value !== 'string') {
		return null;
	}

	try {
		return JSON.parse(value);
	} catch {
		console.error(
			'Failed to parse persisted React DevTools hook settings. Returning default (null).',
		);
		return null;
	}
};

export const savePersistedHookSettings = (settings: unknown): void => {
	localStorage.setItem(GLOBAL_HOOK_SETTINGS, JSON.stringify(settings));
};
