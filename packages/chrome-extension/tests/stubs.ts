/**
 * Thin platform stubs for integration tests.
 * Records WebSocket instantiations and provides configurable Chrome API behavior.
 */

const wsInstances: FakeWebSocket[] = [];

export class FakeWebSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	static get instances(): FakeWebSocket[] {
		return wsInstances;
	}

	static reset(): void {
		wsInstances.length = 0;
	}

	static simulateConnectFailureForNext = false;

	url: string;
	readyState: number;
	_listeners: Record<string, ((...args: unknown[]) => void)[]>;
	_sent: string[];
	_closed: boolean;

	constructor(url: string) {
		this.url = url;
		this._listeners = { open: [], close: [], error: [], message: [] };
		this._sent = [];
		const shouldFail = FakeWebSocket.simulateConnectFailureForNext;
		if (shouldFail) {
			FakeWebSocket.simulateConnectFailureForNext = false;
			this.readyState = 3;
			this._closed = true;
			queueMicrotask(() => this._listeners.close.forEach((fn) => fn()));
		} else {
			this.readyState = 1;
			this._closed = false;
		}
		wsInstances.push(this);
	}

	addEventListener(type: string, fn: (...args: unknown[]) => void): void {
		if (this._listeners[type]) {
			this._listeners[type].push(fn);
		}
	}

	removeEventListener(type: string, fn: (...args: unknown[]) => void): void {
		if (this._listeners[type]) {
			this._listeners[type] = this._listeners[type].filter((f) => f !== fn);
		}
	}

	send(data: string): void {
		this._sent.push(data);
	}

	close(): void {
		this._closed = true;
		this.readyState = 3;
		this._listeners.close.forEach((fn) => fn());
	}

	simulateOpen(): void {
		this.readyState = 1;
		this._listeners.open.forEach((fn) => fn());
	}

	simulateMessage(data: string | object): void {
		const event = {
			data: typeof data === 'string' ? data : JSON.stringify(data),
		};
		this._listeners.message.forEach((fn) => fn(event));
	}

	simulateError(error: Error = new Error('WebSocket error')): void {
		this._listeners.error.forEach((fn) => fn(error));
	}
}

export type ChromeStub = {
	configure: {
		setScriptingResult: (result: unknown) => void;
		setDebuggerTargets: (targets: { id: string; tabId: number }[]) => void;
		setTabData: (tabId: number, data: unknown) => void;
		setStorageData: (data: Record<string, unknown>) => void;
	};
	storage: {
		local: {
			get: (key: string | Record<string, unknown>) => Promise<Record<string, unknown>>;
			set: (data: Record<string, unknown>) => Promise<void>;
		};
	};
	webNavigation: {
		onCompleted: { addListener: (fn: (...args: unknown[]) => void) => void };
	};
	tabs: {
		get: (tabId: number) => Promise<{ title: string }>;
		onRemoved: { addListener: (fn: (tabId: number) => void) => void };
	};
	scripting: {
		executeScript: () => Promise<{ result: unknown }[]>;
	};
	debugger: {
		getTargets: () => Promise<{ id: string; tabId: number }[]>;
		attach: (target: { targetId: string }, version?: string) => void;
		detach: (target: { targetId: string }) => void;
		sendCommand: (
			target: { targetId: string },
			method: string,
			params?: unknown
		) => Promise<unknown>;
		onEvent: { addListener: (fn: (...args: unknown[]) => void) => void };
	};
	runtime: {
		getManifest: () => { version: string };
		getURL: (path: string) => string;
	};
	getListeners: () => {
		webNavigationOnCompleted: ((...args: unknown[]) => void) | null;
		tabsOnRemoved: ((tabId: number) => void) | null;
		debuggerOnEvent: ((...args: unknown[]) => void) | null;
	};
}

export const createChromeStub = (): ChromeStub => {
	let scriptingResult: unknown = { appDisplayName: 'Test', reactNativeVersion: '0.0.0' };
	let debuggerTargets: { id: string; tabId: number }[] = [];
	const tabData: Record<number, unknown> = {};
	let storageData: Record<string, unknown> = {};

	const listeners = {
		webNavigationOnCompleted: null as ((...args: unknown[]) => void) | null,
		tabsOnRemoved: null as ((tabId: number) => void) | null,
		debuggerOnEvent: null as ((...args: unknown[]) => void) | null,
	};

	return {
		configure: {
			setScriptingResult(result: unknown) {
				scriptingResult = result;
			},
			setDebuggerTargets(targets: { id: string; tabId: number }[]) {
				debuggerTargets = targets;
			},
			setTabData(tabId: number, data: unknown) {
				tabData[tabId] = data;
			},
			setStorageData(data: Record<string, unknown>) {
				storageData = { ...data };
			},
		},

		storage: {
			local: {
				async get(key: string | Record<string, unknown>) {
					if (typeof key === 'string') {
						return { [key]: storageData[key] };
					}
					return storageData;
				},
				async set(data: Record<string, unknown>) {
					Object.assign(storageData, data);
				},
			},
		},

		webNavigation: {
			onCompleted: {
				addListener(fn: (...args: unknown[]) => void) {
					listeners.webNavigationOnCompleted = fn;
				},
			},
		},

		tabs: {
			async get(tabId: number) {
				return (tabData[tabId] as { title: string }) ?? { title: 'Untitled' };
			},
			onRemoved: {
				addListener(fn: (tabId: number) => void) {
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
			sendCommand: async () => ({}),
			onEvent: {
				addListener(fn: (...args: unknown[]) => void) {
					listeners.debuggerOnEvent = fn;
				},
			},
		},

		runtime: {
			getManifest: () => ({ version: '1.0.0' }),
			getURL: (path: string) => `chrome-extension://test-id/${path}`,
		},

		getListeners: () => listeners,
	};
};
