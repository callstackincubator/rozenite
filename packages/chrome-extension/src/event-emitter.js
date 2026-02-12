/**
 * A minimal event emitter for pub/sub patterns.
 */
export const createEventEmitter = () => {
	const listeners = new Map();

	/**
	 * Register an event listener.
	 * @param {string} event - Event name
	 * @param {Function} fn - Callback function
	 */
	const on = (event, fn) => {
		if (!listeners.has(event)) {
			listeners.set(event, []);
		}
		listeners.get(event).push(fn);
	};

	/**
	 * Unregister an event listener.
	 * @param {string} event - Event name
	 * @param {Function} fn - Callback function to remove
	 */
	const off = (event, fn) => {
		if (!listeners.has(event)) {
			return;
		}
		const handlers = listeners.get(event);
		const index = handlers.indexOf(fn);
		if (index !== -1) {
			handlers.splice(index, 1);
		}
	};

	/**
	 * Emit an event to all registered listeners.
	 * @param {string} event - Event name
	 * @param {...any} args - Arguments to pass to listeners
	 */
	const emit = (event, ...args) => {
		if (!listeners.has(event)) {
			return;
		}
		const handlers = listeners.get(event);
		for (const handler of handlers) {
			handler(...args);
		}
	};

	return { on, off, emit };
};
