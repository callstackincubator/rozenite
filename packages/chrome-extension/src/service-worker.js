import { createExtension } from './extension.js';
import { createConnection } from './connection.js';
import { createCDPClient } from './cdp-client.js';
import { createPageManager } from './page-manager.js';
import { createReactNativeAgent } from './react-native-agent.js';
import { createBrowserId } from './browser-id.js';
import { getDeviceName } from './device-utils.js';
import { logger } from './logger.js';

const browserIdManager = createBrowserId();

/**
 * Lazily initializes the extension once the browser ID is available.
 * MV3 service workers require event listeners to be registered synchronously,
 * so the extension is created on-demand when the first event fires.
 */
let extPromise;
const getExtension = () => {
	if (!extPromise) {
		extPromise = browserIdManager.getId().then((browserId) => {
			logger.info('Extension initializing with browser ID:', browserId);
			return createExtension({
				createConnection,
				createCDPClient,
				createPageManager,
				createReactNativeAgent,
				getDeviceName,
				browserId,
				logger,
			});
		});
	}
	return extPromise;
};

// Wire up Chrome extension event listeners (registered synchronously for MV3)
chrome.webNavigation.onCompleted.addListener(async (...args) => {
	const ext = await getExtension();
	ext.pageManager.onNavigationCompleted(...args);
});

chrome.tabs.onRemoved.addListener(async (...args) => {
	const ext = await getExtension();
	ext.pageManager.onTabRemoved(...args);
});

chrome.debugger.onEvent.addListener(async (source, method, params) => {
	const ext = await getExtension();
	const page = ext.pageManager.getAll().find(p => p.id === source.targetId);
	if (page) {
		const group = ext.groups.get(page.origin);
		if (group) {
			group.cdpClient.sendWrappedEvent(source.targetId, { method, params });
		}
	}
});
