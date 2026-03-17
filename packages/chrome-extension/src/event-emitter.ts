type EventHandler = (...args: unknown[]) => void;

export type EventEmitter = {
	on: (event: string, fn: EventHandler) => void;
	off: (event: string, fn: EventHandler) => void;
	emit: (event: string, ...args: unknown[]) => void;
}

export const createEventEmitter = (): EventEmitter => {
	const listeners = new Map<string, EventHandler[]>();

	const on = (event: string, fn: EventHandler) => {
		if (!listeners.has(event)) {
			listeners.set(event, []);
		}
		listeners.get(event)!.push(fn);
	};

	const off = (event: string, fn: EventHandler) => {
		if (!listeners.has(event)) {
			return;
		}
		const handlers = listeners.get(event)!;
		const index = handlers.indexOf(fn);
		if (index !== -1) {
			handlers.splice(index, 1);
		}
	};

	const emit = (event: string, ...args: unknown[]) => {
		if (!listeners.has(event)) {
			return;
		}
		const handlers = listeners.get(event)!;
		for (const handler of handlers) {
			handler(...args);
		}
	};

	return { on, off, emit };
};
