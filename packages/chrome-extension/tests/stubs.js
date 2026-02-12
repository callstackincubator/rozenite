/**
 * Thin platform stubs for integration tests.
 * Records WebSocket instantiations and provides configurable Chrome API behavior.
 */

/** Static array of all FakeWebSocket instances created. */
const wsInstances = [];

export class FakeWebSocket {
	// WebSocket constants (matching spec)
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	static get instances() {
		return wsInstances;
	}

	static reset() {
		wsInstances.length = 0;
	}

	/** When true, the next constructed instance starts CLOSED and fires close (simulates connection failure). */
	static simulateConnectFailureForNext = false;

	constructor(url) {
		this.url = url;
		this._listeners = { open: [], close: [], error: [], message: [] };
		this._sent = [];
		const shouldFail = FakeWebSocket.simulateConnectFailureForNext;
		if (shouldFail) {
			FakeWebSocket.simulateConnectFailureForNext = false;
			this.readyState = 3; // CLOSED
			this._closed = true;
			queueMicrotask(() => this._listeners.close.forEach((fn) => fn()));
		} else {
			this.readyState = 1; // OPEN
			this._closed = false;
		}
		wsInstances.push(this);
	}

	addEventListener(type, fn) {
		if (this._listeners[type]) {
			this._listeners[type].push(fn);
		}
	}

	removeEventListener(type, fn) {
		if (this._listeners[type]) {
			this._listeners[type] = this._listeners[type].filter((f) => f !== fn);
		}
	}

	send(data) {
		this._sent.push(data);
	}

	close() {
		this._closed = true;
		this.readyState = 3; // CLOSED (fixed from 0)
		this._listeners.close.forEach((fn) => fn());
	}

	// Test helpers
	simulateOpen() {
		this.readyState = 1;
		this._listeners.open.forEach((fn) => fn());
	}

	simulateMessage(data) {
		const event = { data: typeof data === 'string' ? data : JSON.stringify(data) };
		this._listeners.message.forEach((fn) => fn(event));
	}

	simulateError(error = new Error('WebSocket error')) {
		this._listeners.error.forEach((fn) => fn(error));
	}
}

export const createChromeStub = () => {
	let scriptingResult = { appDisplayName: 'Test', reactNativeVersion: '0.0.0' };
	let debuggerTargets = [];
	let tabData = {};
	let storageData = {};

	const listeners = {
		webNavigationOnCompleted: null,
		tabsOnRemoved: null,
		debuggerOnEvent: null,
	};

	return {
		configure: {
			setScriptingResult(result) {
				scriptingResult = result;
			},
			setDebuggerTargets(targets) {
				debuggerTargets = targets;
			},
			setTabData(tabId, data) {
				tabData[tabId] = data;
			},
			setStorageData(data) {
				storageData = { ...data };
			},
		},

		storage: {
			local: {
				async get(key) {
					if (typeof key === 'string') {
						return { [key]: storageData[key] };
					}
					return storageData;
				},
				async set(data) {
					Object.assign(storageData, data);
				},
			},
		},

		webNavigation: {
			onCompleted: {
				addListener(fn) {
					listeners.webNavigationOnCompleted = fn;
				},
			},
		},

		tabs: {
			async get(tabId) {
				return tabData[tabId] ?? { title: 'Untitled' };
			},
			onRemoved: {
				addListener(fn) {
					listeners.tabsOnRemoved = fn;
				},
			},
		},

		scripting: {
			async executeScript() {
				return [{ result: scriptingResult }];
			},
		},

		debugger: {
			async getTargets() {
				return debuggerTargets;
			},
			attach: () => { },
			detach: () => { },
			sendCommand: () => { },
			onEvent: {
				addListener(fn) {
					listeners.debuggerOnEvent = fn;
				},
			},
		},

		getListeners: () => listeners,
	};
};
