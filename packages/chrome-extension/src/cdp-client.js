import { logger } from './logger.js';

const CHROME_DEBUGGER_VERSION = '1.3';

/**
 * Chrome DevTools Protocol (CDP) client.
 * Handles all Chrome debugger interactions and message formatting.
 *
 * @param {Object} connection - WebSocket connection instance
 * @param {Object} reactNativeAgent - React Native Application agent
 */
export const createCDPClient = (connection, reactNativeAgent) => {
	/**
	 * Send the list of available pages.
	 * @param {Array} pages - Array of page objects
	 */
	const sendPages = (pages) => {
		connection.send('getPages', pages);
	};

	// React Native DevTools expects the default execution context to be named 'main'.
	// Chrome uses the page URL as the name instead, so we rewrite it here.
	const patchEvent = ({ method, params }) => {
		if (
			method === 'Runtime.executionContextCreated' &&
			params?.context?.auxData?.isDefault
		) {
			return { method, params: { ...params, context: { ...params.context, name: 'main' } } };
		}
		return { method, params };
	};

	/**
	 * Send a wrapped CDP event.
	 * @param {string} pageId - Target page ID
	 * @param {Object} event - CDP event object with method and params
	 */
	const sendWrappedEvent = (pageId, event) => {
		connection.send('wrappedEvent', {
			pageId,
			wrappedEvent: JSON.stringify(patchEvent(event)),
		});
	};

	/**
	 * Attach the Chrome debugger to a page.
	 * @param {string} pageId - Target page ID
	 */
	const attach = (pageId) => {
		logger.info('Debugger attaching to page', pageId);
		chrome.debugger.attach({ targetId: pageId }, CHROME_DEBUGGER_VERSION);
	};

	/**
	 * Detach the Chrome debugger from a page.
	 * @param {string} pageId - Target page ID
	 */
	const detach = (pageId) => {
		logger.info('Debugger detaching from page', pageId);
		chrome.debugger.detach({ targetId: pageId });
	};

	/**
	 * Handle a CDP command from the server.
	 * Sends the command via Chrome debugger and relays the response.
	 * @param {string} pageId - Target page ID
	 * @param {string} wrappedEvent - JSON-serialized CDP command
	 */
	const handleCommand = async (pageId, wrappedEvent) => {
		try {
			const event = JSON.parse(wrappedEvent);

			// Page.getResourceTree causes a side-effect of changing the page title
			// in React Native DevTools, so we block it with a "command not found" error.
			if (event.method === 'Page.getResourceTree') {
				connection.send('wrappedEvent', {
					pageId,
					wrappedEvent: JSON.stringify({
						id: event.id,
						error: { code: -32601, message: `'${event.method}' wasn't found` },
					}),
				});
				return;
			}

			// Check if ReactNativeApplication agent should handle this command
			if (reactNativeAgent && reactNativeAgent.shouldHandle(event)) {
				const sendResponse = (response) => {
					connection.send('wrappedEvent', {
						pageId,
						wrappedEvent: JSON.stringify(response),
					});
				};

				reactNativeAgent.handleCommand(pageId, event, sendResponse);
				return;
			}

			// Default: send command via Chrome debugger
			const response = await chrome.debugger.sendCommand(
				{ targetId: pageId },
				event.method,
				event.params
			);

			connection.send('wrappedEvent', {
				pageId,
				wrappedEvent: JSON.stringify({
					id: event.id,
					result: response,
				}),
			});
		} catch (error) {
			logger.warn('CDP command failed for page', pageId, error);
			const event = JSON.parse(wrappedEvent);
			connection.send('wrappedEvent', {
				pageId,
				wrappedEvent: JSON.stringify({
					id: event.id,
					error,
				}),
			});
		}
	};

	return {
		sendPages,
		sendWrappedEvent,
		attach,
		detach,
		handleCommand,
	};
};
