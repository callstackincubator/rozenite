import { logger } from './logger.js';

const STORAGE_KEY = 'browserId';

/**
 * Manages a persistent browser UUID.
 * Generates a UUID on first use and stores it in chrome.storage.local.
 * Subsequent calls return the cached value.
 *
 * @returns {{ getId: () => Promise<string> }}
 */
export const createBrowserId = () => {
	let cachedId = null;

	/**
	 * Get the browser UUID, generating and persisting one if it doesn't exist yet.
	 * @returns {Promise<string>}
	 */
	const getId = async () => {
		if (cachedId) {
			return cachedId;
		}

		const result = await chrome.storage.local.get(STORAGE_KEY);
		if (result[STORAGE_KEY]) {
			cachedId = result[STORAGE_KEY];
			logger.info('Browser ID loaded:', cachedId);
			return cachedId;
		}

		cachedId = crypto.randomUUID();
		await chrome.storage.local.set({ [STORAGE_KEY]: cachedId });
		logger.info('Browser ID generated:', cachedId);
		return cachedId;
	};

	return { getId };
};
