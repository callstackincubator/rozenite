import { createExtension } from './extension.js';
import { createConnection } from './connection.js';
import { createCDPClient } from './cdp-client.js';
import { createPageManager } from './page-manager.js';
import { createReactNativeAgent } from './react-native-agent.js';
import { createBrowserId } from './browser-id.js';
import { getDeviceName } from './device-utils.js';
import { logger } from './logger.js';

const browserIdManager = createBrowserId();

let extPromise: Promise<ReturnType<typeof createExtension>> | undefined;

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

chrome.webNavigation.onCompleted.addListener(async (...args) => {
	const ext = await getExtension();
	ext.pageManager.onNavigationCompleted(
		args[0] as chrome.webNavigation.WebNavigationFramedCallbackDetails
	);
});

chrome.tabs.onRemoved.addListener(async (...args) => {
	const ext = await getExtension();
	ext.pageManager.onTabRemoved(args[0] as number);
});

chrome.debugger.onEvent.addListener(async (source, method, params) => {
	const targetId = source.targetId;
	if (!targetId) return;
	const ext = await getExtension();
	const page = ext.pageManager.getAll().find((p) => p.id === targetId);
	if (page) {
		const group = ext.groups.get(page.origin);
		if (group) {
			group.cdpClient.sendWrappedEvent(targetId, {
				method,
				params: params as Record<string, unknown> | undefined,
			});
		}
	}
});
