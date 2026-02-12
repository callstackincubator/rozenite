import { createEventEmitter } from './event-emitter.js';
import { logger } from './logger.js';

const WS_PROTOCOL = 'ws://';
const WS_PATH = '/inspector/device';

export type ConnectionConfig = {
	host: string;
	deviceId: string;
	deviceName: string;
	app: string;
	profiling: string;
}

export type Connection = {
	connect: () => void;
	send: (event: string, payload?: unknown) => void;
	close: () => void;
	isConnected: () => boolean;
	on: (event: string, fn: (...args: unknown[]) => void) => void;
	off: (event: string, fn: (...args: unknown[]) => void) => void;
	emit: (event: string, ...args: unknown[]) => void;
}

export const createConnection = ({
	host,
	deviceId,
	deviceName,
	app,
	profiling,
}: ConnectionConfig): Connection => {
	const emitter = createEventEmitter();
	let ws: WebSocket | undefined;

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
				const data = JSON.parse(event.data) as { event?: string; payload?: unknown };

				if (data.event) {
					emitter.emit(data.event, data.payload);
				}
			} catch (error) {
				logger.error('Failed to parse WebSocket message:', error);
			}
		});
	};

	const send = (event: string, payload?: unknown) => {
		if (ws?.readyState === WebSocket.OPEN) {
			const message = JSON.stringify({ event, payload });
			ws.send(message);
		} else {
			logger.warn('WebSocket is not open, message not sent');
		}
	};

	const close = () => {
		if (ws) {
			ws.close();
		}
	};

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
