import { logger } from './logger.js';

const GITHUB_MANIFEST_URL =
	'https://raw.githubusercontent.com/callstackincubator/rozenite/main/packages/chrome-extension/manifest.json';
const RELEASES_URL = 'https://github.com/callstackincubator/rozenite/releases';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY_DISMISSED = 'rozenite_update_dismissed_until';

export function isNewerVersion(oldVer: string, newVer: string): boolean {
	const oldParts = oldVer.split('.').map(Number);
	const newParts = newVer.split('.').map(Number);
	for (let i = 0; i < Math.max(oldParts.length, newParts.length); i++) {
		if ((newParts[i] || 0) > (oldParts[i] || 0)) return true;
		if ((newParts[i] || 0) < (oldParts[i] || 0)) return false;
	}
	return false;
}

export async function isDismissed(): Promise<boolean> {
	const result = await chrome.storage.local.get(STORAGE_KEY_DISMISSED);
	const until = result[STORAGE_KEY_DISMISSED];
	return typeof until === 'number' && Date.now() < until;
}

export async function checkForUpdates(): Promise<{
	hasUpdate: boolean;
	latestVersion?: string;
	releasesUrl?: string;
}> {
	if (await isDismissed()) {
		logger.info('Update check skipped: banner dismissed within last 24h');
		return { hasUpdate: false };
	}

	const response = await fetch(GITHUB_MANIFEST_URL, { cache: 'no-cache' });
	const data = await response.json();
	const latestVersion: string = data.version;
	const currentVersion = chrome.runtime.getManifest().version;

	logger.info('Update check:', { currentVersion, latestVersion });

	if (isNewerVersion(currentVersion, latestVersion)) {
		logger.info('Update available:', latestVersion);
		return { hasUpdate: true, latestVersion, releasesUrl: RELEASES_URL };
	}
	logger.info('Extension is up to date');
	return { hasUpdate: false };
}

export { STORAGE_KEY_DISMISSED, DISMISS_DURATION_MS };
