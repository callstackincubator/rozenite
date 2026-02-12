/**
 * Extension orchestration logic.
 * Creates and wires PageManager, connection groups, and lazy socket management.
 *
 * @param {Object} deps - Dependencies
 * @param {Function} deps.createConnection - Connection factory
 * @param {Function} deps.createCDPClient - CDP client factory
 * @param {Function} deps.createPageManager - Page manager factory
 * @param {Function} deps.createReactNativeAgent - React Native agent factory
 * @param {Function} deps.getDeviceName - Device name getter
 * @param {string} deps.browserId - Unique browser instance identifier (UUID)
 * @param {Object} deps.logger - Logger instance
 * @returns {{ pageManager: Object, groups: Map, getOrCreateGroup: Function, removeGroup: Function }}
 */
export const createExtension = ({
	createConnection,
	createCDPClient,
	createPageManager,
	createReactNativeAgent,
	getDeviceName,
	browserId,
	logger,
}) => {
	const config = {
		deviceId: browserId,
		deviceName: `Rozenite (${getDeviceName()})`,
		// It would be better to use the app name, but we don't have access to it here.
		app: 'React Native Web',
		profiling: 'false',
	};

	const pageManager = createPageManager(config.app);
	const groups = new Map(); // origin -> { connection, cdpClient, reactNativeAgent }

	/**
	 * Get or create a connection group for a specific origin.
	 * @param {string} origin - Origin (e.g., 'localhost:8081')
	 * @returns {Object} Group object with connection, cdpClient, and reactNativeAgent
	 */
	const getOrCreateGroup = (origin) => {
		if (groups.has(origin)) {
			const group = groups.get(origin);
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
			cdpClient.sendPages(pageManager.getByOrigin(origin));
		});

		connection.on('connect', ({ pageId }) => {
			cdpClient.attach(pageId);
		});

		connection.on('disconnect', ({ pageId }) => {
			cdpClient.detach(pageId);
		});

		connection.on('wrappedEvent', ({ pageId, wrappedEvent }) => {
			cdpClient.handleCommand(pageId, wrappedEvent);
		});

		connection.connect();

		const group = { connection, cdpClient, reactNativeAgent };
		groups.set(origin, group);
		return group;
	};

	/**
	 * Remove a connection group for a specific origin.
	 * @param {string} origin - Origin to remove
	 */
	const removeGroup = (origin) => {
		const group = groups.get(origin);
		if (group) {
			logger.info('Removing connection group for origin:', origin);
			group.connection.close();
			groups.delete(origin);
		}
	};

	pageManager.on('added', (page) => {
		logger.info('Compatible page added for origin:', page.origin);
		getOrCreateGroup(page.origin);
	});

	pageManager.on('removed', (page) => {
		if (!pageManager.hasPagesForOrigin(page.origin)) {
			logger.info('No compatible pages remaining for origin:', page.origin);
			removeGroup(page.origin);
		}
	});

	pageManager.on('refreshed', (page) => {
		logger.info('Page refreshed for origin:', page.origin);
		getOrCreateGroup(page.origin);
	});

	return { pageManager, groups, getOrCreateGroup, removeGroup };
};
