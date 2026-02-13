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

export type RozeniteMetadata = {
	appDisplayName?: string;
	reactNativeVersion?: string;
	[key: string]: unknown;
}

export interface TrackedPage {
	id: string;
	tabId: number;
	title: string;
	description: string;
	origin: string;
	app: string;
	reactNativeMetadata: RozeniteMetadata | null;
	capabilities: {
		nativePageReloads: boolean;
		nativeSourceCodeFetching: boolean;
		prefersFuseboxFrontend: boolean;
		supportsMultipleDebuggers: boolean;
	};
}

export type PageManager = {
	onNavigationCompleted: (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => Promise<void>;
	onTabRemoved: (tabId: number) => void;
	getAll: () => TrackedPage[];
	getByOrigin: (origin: string) => TrackedPage[];
	hasPagesForOrigin: (origin: string) => boolean;
	hasPages: () => boolean;
	remove: (pageId: string) => void;
	clear: () => void;
	on: (event: string, fn: (...args: unknown[]) => void) => void;
	off: (event: string, fn: (...args: unknown[]) => void) => void;
}

export const createPageManager = (app: string): PageManager => {
	const emitter = createEventEmitter();
	const pages: TrackedPage[] = [];

	const isInspectableUrl = (url: string | undefined): boolean => {
		if (!url) {
			return false;
		}
		return INSPECTABLE_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
	};

	const getRozeniteMetadata = async (tabId: number): Promise<RozeniteMetadata | null> => {
		try {
			const results = await chrome.scripting.executeScript({
				target: { tabId },
				world: 'MAIN',
				func: (globalFlag: string) => {
					return (globalThis as Record<string, unknown>)[globalFlag] ?? null;
				},
				args: [ROZENITE_GLOBAL_FLAG],
			});
			return results[0].result as RozeniteMetadata | null;
		} catch (error) {
			logger.warn('Failed to read Rozenite metadata for tab', tabId, error);
			return null;
		}
	};

	const removeByTabId = (tabId: number) => {
		const index = pages.findIndex((page) => page.tabId === tabId);
		if (index !== -1) {
			const [removed] = pages.splice(index, 1);
			logger.info('Page removed for tab', tabId);
			emitter.emit('removed', removed);
		}
	};

	const onNavigationCompleted = async (
		details: chrome.webNavigation.WebNavigationFramedCallbackDetails
	) => {
		const { tabId, url, frameId } = details;

		if (frameId !== 0) {
			return;
		}

		if (!isInspectableUrl(url)) {
			removeByTabId(tabId);
			return;
		}

		const rozeniteMetadata = await getRozeniteMetadata(tabId);
		if (!rozeniteMetadata) {
			removeByTabId(tabId);
			return;
		}

		logger.info('Rozenite-enabled tab found:', url);

		try {
			const targets = await chrome.debugger.getTargets();
			const target = targets.find((t) => t.tabId === tabId);

			if (target) {
				const existingIndex = pages.findIndex((page) => page.id === target.id);
				const deviceName = getDeviceName();

				const page: TrackedPage = {
					id: target.id,
					tabId,
					title: `React Native Web (${deviceName})`,
					description: 'Rozenite for Web',
					origin: new URL(url!).host,
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
					const oldPage = pages[existingIndex];
					if (oldPage.origin !== page.origin) {
						logger.info('Page origin changed:', oldPage.origin, '->', page.origin);
						emitter.emit('removed', oldPage);
						pages[existingIndex] = page;
						emitter.emit('added', page);
					} else {
						pages[existingIndex] = page;
						emitter.emit('refreshed', page);
					}
				} else {
					logger.info('New page tracked:', page.origin, page.id);
					pages.push(page);
					emitter.emit('added', page);
				}
			}
		} catch (error) {
			logger.warn('Failed to get debugger targets:', error);
		}
	};

	const onTabRemoved = (tabId: number) => {
		removeByTabId(tabId);
	};

	const getAll = () => [...pages];

	const getByOrigin = (origin: string) => pages.filter((page) => page.origin === origin);

	const hasPagesForOrigin = (origin: string) => pages.some((page) => page.origin === origin);

	const hasPages = () => pages.length > 0;

	const remove = (pageId: string) => {
		const index = pages.findIndex((page) => page.id === pageId);
		if (index !== -1) {
			const [removed] = pages.splice(index, 1);
			emitter.emit('removed', removed);
		}
	};

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
