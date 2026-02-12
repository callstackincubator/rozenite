import type { Connection } from './connection.js';
import type { CDPClient, CDPPageLike } from './cdp-client.js';
import type { PageManager } from './page-manager.js';
import type { ReactNativeAgent } from './react-native-agent.js';
import type { Logger } from './logger.js';

export type ConnectionGroup = {
	connection: Connection;
	cdpClient: CDPClient;
	reactNativeAgent: ReactNativeAgent;
}

export type ExtensionDeps = {
	createConnection: (config: {
		host: string;
		deviceId: string;
		deviceName: string;
		app: string;
		profiling: string;
	}) => Connection;
	createCDPClient: (
		connection: Connection,
		reactNativeAgent: ReactNativeAgent | null
	) => CDPClient;
	createPageManager: (app: string) => PageManager;
	createReactNativeAgent: (pageManager: PageManager) => ReactNativeAgent;
	getDeviceName: () => string;
	browserId: string;
	logger: Logger;
}

export type Extension = {
	pageManager: PageManager;
	groups: Map<string, ConnectionGroup>;
	getOrCreateGroup: (origin: string) => ConnectionGroup;
	removeGroup: (origin: string) => void;
}

export const createExtension = ({
	createConnection,
	createCDPClient,
	createPageManager,
	createReactNativeAgent,
	getDeviceName,
	browserId,
	logger,
}: ExtensionDeps): Extension => {
	const config = {
		deviceId: browserId,
		deviceName: `Rozenite (${getDeviceName()})`,
		app: 'React Native Web',
		profiling: 'false',
	};

	const pageManager = createPageManager(config.app);
	const groups = new Map<string, ConnectionGroup>();

	const getOrCreateGroup = (origin: string): ConnectionGroup => {
		if (groups.has(origin)) {
			const group = groups.get(origin)!;
			if (!group.connection.isConnected()) {
				logger.info('Connection lost for origin, reconnecting:', origin);
				group.connection.connect();
			}
			return group;
		}

		logger.info('Creating connection group for origin:', origin);

		const connection = createConnection({ ...config, host: origin });
		const reactNativeAgent = createReactNativeAgent(pageManager);
		const cdpClient = createCDPClient(connection, reactNativeAgent);

		connection.on('getPages', () => {
			cdpClient.sendPages(pageManager.getByOrigin(origin) as unknown as CDPPageLike[]);
		});

		connection.on('connect', (payload) => {
			cdpClient.attach((payload as { pageId: string }).pageId);
		});

		connection.on('disconnect', (payload) => {
			cdpClient.detach((payload as { pageId: string }).pageId);
		});

		connection.on('wrappedEvent', (payload) => {
			const { pageId, wrappedEvent } = payload as { pageId: string; wrappedEvent: string };
			cdpClient.handleCommand(pageId, wrappedEvent);
		});

		connection.connect();

		const group = { connection, cdpClient, reactNativeAgent };
		groups.set(origin, group);
		return group;
	};

	const removeGroup = (origin: string) => {
		const group = groups.get(origin);
		if (group) {
			logger.info('Removing connection group for origin:', origin);
			group.connection.close();
			groups.delete(origin);
		}
	};

	pageManager.on('added', (page) => {
		const p = page as { origin: string };
		logger.info('Compatible page added for origin:', p.origin);
		getOrCreateGroup(p.origin);
	});

	pageManager.on('removed', (page) => {
		const p = page as { origin: string };
		if (!pageManager.hasPagesForOrigin(p.origin)) {
			logger.info('No compatible pages remaining for origin:', p.origin);
			removeGroup(p.origin);
		}
	});

	pageManager.on('refreshed', (page) => {
		const p = page as { origin: string };
		logger.info('Page refreshed for origin:', p.origin);
		getOrCreateGroup(p.origin);
	});

	return { pageManager, groups, getOrCreateGroup, removeGroup };
};
