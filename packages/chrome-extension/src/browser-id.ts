import { logger } from './logger.js';

const STORAGE_KEY = 'browserId';

export type BrowserIdManager = {
	getId: () => Promise<string>;
}

export const createBrowserId = (): BrowserIdManager => {
	let cachedId: string | null = null;

	const getId = async (): Promise<string> => {
		if (cachedId) {
			return cachedId;
		}

		const result = await chrome.storage.local.get(STORAGE_KEY);
		if (result[STORAGE_KEY]) {
			cachedId = result[STORAGE_KEY] as string;
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
