import { createEventEmitter } from './event-emitter.js';
import { logger } from './logger.js';

const WS_PROTOCOL = 'ws://';
const WS_PATH = '/inspector/device';

/**
 * Manages WebSocket connection to the debugger server.
 * Emits typed events for incoming messages: 'getPages', 'connect', 'disconnect', 'wrappedEvent'.
 * Also emits 'open', 'close', 'error' for connection state changes.
 *
 * @param {Object} config - Connection configuration
 * @param {string} config.host - Host and port (e.g., 'localhost:8081')
 * @param {string} config.deviceId - Device identifier
 * @param {string} config.deviceName - Human-readable device name
 * @param {string} config.app - Application identifier
 * @param {string} config.profiling - Profiling flag ('true' or 'false')
 */
export const createConnection = ({ host, deviceId, deviceName, app, profiling }) => {
	const emitter = createEventEmitter();
	let ws;

	const connect = () => {
		const url = `${WS_PROTOCOL}${host}${WS_PATH}?device=${deviceId}&name=${deviceName}&app=${app}&profiling=${profiling}`;

		logger.info('WebSocket connecting to', host);
		ws = new WebSocket(url);

		ws.addEventListener('open', () => {
			logger.info('WebSocket connected to', host);
			emitter.emit('open');
		});

		ws.addEventListener('close', () => {
			logger.info('WebSocket closed for', host);
			emitter.emit('close');
		});

		ws.addEventListener('error', (error) => {
			logger.error('WebSocket error for', host, error);
			emitter.emit('error', error);
		});

		ws.addEventListener('message', (event) => {
			try {
				const data = JSON.parse(event.data);

				// Emit typed event with payload
				if (data.event) {
					emitter.emit(data.event, data.payload);
				}
			} catch (error) {
				logger.error('Failed to parse WebSocket message:', error);
			}
		});
	};

	/**
	 * Send a message through the WebSocket.
	 * @param {string} event - Event name
	 * @param {any} payload - Event payload
	 */
	const send = (event, payload) => {
		if (ws.readyState === WebSocket.OPEN) {
			const message = JSON.stringify({ event, payload });
			ws.send(message);
		} else {
			logger.warn('WebSocket is not open, message not sent');
		}
	};

	/**
	 * Close the WebSocket connection.
	 */
	const close = () => {
		if (ws) {
			ws.close();
		}
	};

	/**
	 * Check if the WebSocket connection is currently open.
	 * @returns {boolean}
	 */
	const isConnected = () => ws != null && ws.readyState === WebSocket.OPEN;

	return {
		connect,
		send,
		close,
		isConnected,
		on: emitter.on,
		off: emitter.off,
		emit: emitter.emit,
	};
};
