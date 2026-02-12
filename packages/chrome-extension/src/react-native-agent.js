import { getDeviceName } from './device-utils.js';
import { logger } from './logger.js';

/**
 * React Native Application CDP Agent.
 * Handles ReactNativeApplication domain commands.
 * @param {Object} pageManager - Page manager instance for looking up page metadata
 */
export const createReactNativeAgent = (pageManager) => {
	let enabled = false;

	/**
	 * Get metadata for the React Native application.
	 * @param {string} pageId - Target page ID
	 * @returns {Object} Application metadata
	 */
	const getMetadata = (pageId) => {
		const page = pageManager.getAll().find(p => p.id === pageId);
		const rnMeta = page?.reactNativeMetadata || {};

		return {
			appDisplayName: rnMeta.appDisplayName || 'Unknown App',
			appIdentifier: '',
			deviceName: getDeviceName(),
			integrationName: 'Rozenite',
			platform: 'web',
			reactNativeVersion: rnMeta.reactNativeVersion || '0.0.0',
			unstable_isProfilingBuild: false,
			unstable_networkInspectionEnabled: true,
		};
	};

	/**
	 * Check if this agent should handle the given command.
	 * @param {Object} event - Parsed CDP event
	 * @returns {boolean}
	 */
	const shouldHandle = (event) => {
		return event.method && event.method.startsWith('ReactNativeApplication.');
	};

	/**
	 * Handle ReactNativeApplication domain commands.
	 * @param {string} pageId - Target page ID
	 * @param {Object} event - Parsed CDP event
	 * @param {Function} sendResponse - Function to send response
	 * @returns {boolean} True if command was handled
	 */
	const handleCommand = (pageId, event, sendResponse) => {
		if (!shouldHandle(event)) {
			return false;
		}

		switch (event.method) {
			case 'ReactNativeApplication.enable':
				enabled = true;
				logger.info('ReactNativeApplication agent enabled');

				// Send successful response
				sendResponse({
					id: event.id,
					result: {},
				});


				// Send metadataUpdated event
				sendResponse({
					method: 'ReactNativeApplication.metadataUpdated',
					params: getMetadata(pageId),
				});

				return true;

			case 'ReactNativeApplication.disable':
				enabled = false;
				logger.info('ReactNativeApplication agent disabled');
				sendResponse({
					id: event.id,
					result: {},
				});
				return true;

			default:
				// Unknown method in ReactNativeApplication domain
				sendResponse({
					id: event.id,
					error: {
						code: -32601,
						message: `Method '${event.method}' not found`,
					},
				});
				return true;
		}
	};

	/**
	 * Check if the agent is currently enabled.
	 * @returns {boolean}
	 */
	const isEnabled = () => enabled;

	return {
		shouldHandle,
		handleCommand,
		isEnabled,
	};
};
