import { createEventEmitter } from './event-emitter.js';
import { logger } from './logger.js';
import { getDeviceName } from './device-utils.js';

const INSPECTABLE_URL_PREFIXES = [
	'http://localhost:',
	'https://localhost:',
	'http://127.0.0.1:',
	'https://127.0.0.1:',
];

const ROZENITE_GLOBAL_FLAG = '__ROZENITE_WEB__';

/**
 * Manages tracked pages (tabs with Rozenite enabled).
 * Emits 'added' and 'removed' events when pages change.
 *
 * @param {string} app - Application identifier
 */
export const createPageManager = (app) => {
	const emitter = createEventEmitter();
	const pages = [];

	/**
	 * Check if a URL is inspectable (localhost pages only).
	 * Chrome extensions cannot inject scripts into chrome://, chrome-extension://, edge://, etc.
	 * We only want to check localhost URLs for Rozenite.
	 * @param {string} url - URL to check
	 * @returns {boolean}
	 */
	const isInspectableUrl = (url) => {
		if (!url) {
			return false;
		}

		// Only check localhost URLs
		return INSPECTABLE_URL_PREFIXES.some(prefix => url.startsWith(prefix));
	};

	/**
	 * Read the __ROZENITE_WEB__ global from the tab's main world.
	 * Returns the object if present, or null if not.
	 * @param {number} tabId - Chrome tab ID
	 * @returns {Promise<Object|null>}
	 */
	const getRozeniteMetadata = async (tabId) => {
		try {
			const results = await chrome.scripting.executeScript({
				target: { tabId },
				world: 'MAIN',
				func: (globalFlag) => {
					return globalThis[globalFlag] ?? null;
				},
				args: [ROZENITE_GLOBAL_FLAG],
			});
			return results[0].result;
		} catch (error) {
			logger.warn('Failed to read Rozenite metadata for tab', tabId);
			return null;
		}
	};

	/**
	 * Remove a page by tab ID (used when a tab is closed or navigated away).
	 * @param {number} tabId - Chrome tab ID
	 */
	const removeByTabId = (tabId) => {
		const index = pages.findIndex(page => page.tabId === tabId);
		if (index !== -1) {
			const [removed] = pages.splice(index, 1);
			logger.info('Page removed for tab', tabId);
			emitter.emit('removed', removed);
		}
	};

	/**
	 * Handle webNavigation.onCompleted events (full page loads).
	 * Adds Rozenite-enabled tabs to the tracked pages list.
	 * Removes tabs that are no longer compatible.
	 * @param {Object} details - Details from chrome.webNavigation.onCompleted
	 * @param {number} details.tabId - Chrome tab ID
	 * @param {string} details.url - URL of the navigation
	 * @param {number} details.frameId - Frame ID (0 = main frame)
	 */
	const onNavigationCompleted = async (details) => {
		const { tabId, url, frameId } = details;

		// Only handle main frame navigations
		if (frameId !== 0) {
			return;
		}

		// If the URL is not inspectable, remove any tracked page for this tab
		if (!isInspectableUrl(url)) {
			removeByTabId(tabId);
			return;
		}

		const rozeniteMetadata = await getRozeniteMetadata(tabId);
		if (!rozeniteMetadata) {
			// Tab is on a localhost URL but doesn't have Rozenite — remove if tracked
			removeByTabId(tabId);
			return;
		}

		logger.info('Rozenite-enabled tab found:', url);

		try {
			const targets = await chrome.debugger.getTargets();
			const target = targets.find((target) => target.tabId === tabId);

			if (target) {
				// Check if page already exists
				const existingIndex = pages.findIndex(page => page.id === target.id);
				const deviceName = getDeviceName();

				const page = {
					id: target.id,
					tabId,
					title: `React Native Web (${deviceName})`,
					description: 'Rozenite for Web',
					origin: new URL(url).host,
					app,
					reactNativeMetadata: rozeniteMetadata,
					capabilities: {
						nativePageReloads: true,
						nativeSourceCodeFetching: true,
						prefersFuseboxFrontend: true,
						supportsMultipleDebuggers: false,
					},
				};

				if (existingIndex !== -1) {
					// Check if origin changed
					const oldPage = pages[existingIndex];
					if (oldPage.origin !== page.origin) {
						// Origin changed - emit removed for old, added for new
						logger.info('Page origin changed:', oldPage.origin, '->', page.origin);
						emitter.emit('removed', oldPage);
						pages[existingIndex] = page;
						emitter.emit('added', page);
					} else {
						// Same origin - just update
						pages[existingIndex] = page;
						emitter.emit('refreshed', page);
					}
				} else {
					// Add new page
					logger.info('New page tracked:', page.origin, page.id);
					pages.push(page);
					emitter.emit('added', page);
				}
			}
		} catch (error) {
			logger.warn('Failed to get debugger targets:', error);
		}
	};

	/**
	 * Handle tab removal events.
	 * Removes the tab from the tracked pages list.
	 * @param {number} tabId - Chrome tab ID
	 */
	const onTabRemoved = (tabId) => {
		removeByTabId(tabId);
	};

	/**
	 * Get all tracked pages.
	 * @returns {Array} Copy of pages array
	 */
	const getAll = () => [...pages];

	/**
	 * Get pages by origin.
	 * @param {string} origin - Origin to filter by (e.g., 'localhost:8081')
	 * @returns {Array} Pages for the specified origin
	 */
	const getByOrigin = (origin) => pages.filter(page => page.origin === origin);

	/**
	 * Check if there are any tracked pages for a specific origin.
	 * @param {string} origin - Origin to check
	 * @returns {boolean}
	 */
	const hasPagesForOrigin = (origin) => pages.some(page => page.origin === origin);

	/**
	 * Check if there are any tracked pages.
	 * @returns {boolean}
	 */
	const hasPages = () => pages.length > 0;

	/**
	 * Remove a page by ID.
	 * @param {string} pageId - Page ID to remove
	 */
	const remove = (pageId) => {
		const index = pages.findIndex(page => page.id === pageId);
		if (index !== -1) {
			const [removed] = pages.splice(index, 1);
			emitter.emit('removed', removed);
		}
	};

	/**
	 * Clear all tracked pages.
	 */
	const clear = () => {
		pages.length = 0;
	};

	return {
		onNavigationCompleted,
		onTabRemoved,
		getAll,
		getByOrigin,
		hasPagesForOrigin,
		hasPages,
		remove,
		clear,
		on: emitter.on,
		off: emitter.off,
	};
};
