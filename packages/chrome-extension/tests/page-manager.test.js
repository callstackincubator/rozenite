import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createPageManager } from '../src/page-manager.js';

const noopLogger = { info: () => { }, warn: () => { }, error: () => { } };

const createChromeStub = () => {
	let scriptingResult = { appDisplayName: 'Test', reactNativeVersion: '0.0.0' };
	let debuggerTargets = [];
	let tabData = {};

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
		},
		tabs: {
			async get(tabId) {
				return tabData[tabId] ?? { title: 'Untitled' };
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
		},
	};
};

describe('PageManager', () => {
	let chromeStub;

	beforeEach(() => {
		globalThis.logger = noopLogger;
		chromeStub = createChromeStub();
		globalThis.chrome = chromeStub;
	});

	describe('isInspectableUrl', () => {
		it('accepts http://localhost URLs', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);
			chromeStub.configure.setTabData(1, { title: 'Test' });

			const addedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });

			assert.strictEqual(addedEvents.length, 1);
		});

		it('accepts https://localhost URLs', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);
			chromeStub.configure.setTabData(1, { title: 'Test' });

			const addedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'https://localhost:8081/', frameId: 0 });

			assert.strictEqual(addedEvents.length, 1);
		});

		it('accepts http://127.0.0.1 URLs', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);
			chromeStub.configure.setTabData(1, { title: 'Test' });

			const addedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://127.0.0.1:3000/', frameId: 0 });

			assert.strictEqual(addedEvents.length, 1);
		});

		it('accepts https://127.0.0.1 URLs', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);
			chromeStub.configure.setTabData(1, { title: 'Test' });

			const addedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'https://127.0.0.1:3000/', frameId: 0 });

			assert.strictEqual(addedEvents.length, 1);
		});

		it('rejects chrome:// URLs', async () => {
			const pm = createPageManager('');

			const addedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'chrome://extensions/', frameId: 0 });

			assert.strictEqual(addedEvents.length, 0);
		});

		it('rejects https://example.com URLs', async () => {
			const pm = createPageManager('');

			const addedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'https://example.com/', frameId: 0 });

			assert.strictEqual(addedEvents.length, 0);
		});

		it('rejects null URL', async () => {
			const pm = createPageManager('');

			const addedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: null, frameId: 0 });

			assert.strictEqual(addedEvents.length, 0);
		});

		it('rejects undefined URL', async () => {
			const pm = createPageManager('');

			const addedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: undefined, frameId: 0 });

			assert.strictEqual(addedEvents.length, 0);
		});

		it('rejects empty string URL', async () => {
			const pm = createPageManager('');

			const addedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: '', frameId: 0 });

			assert.strictEqual(addedEvents.length, 0);
		});
	});

	describe('onNavigationCompleted', () => {
		it('ignores non-main-frame navigations', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);

			const addedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 1 });

			assert.strictEqual(addedEvents.length, 0);
		});

		it('removes page when URL becomes non-inspectable', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);
			chromeStub.configure.setTabData(1, { title: 'Test' });

			const addedEvents = [];
			const removedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));
			pm.on('removed', (page) => removedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });
			assert.strictEqual(addedEvents.length, 1);

			await pm.onNavigationCompleted({ tabId: 1, url: 'https://example.com/', frameId: 0 });
			assert.strictEqual(removedEvents.length, 1);
		});

		it('removes page when Rozenite metadata is missing', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);
			chromeStub.configure.setTabData(1, { title: 'Test' });

			const addedEvents = [];
			const removedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));
			pm.on('removed', (page) => removedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });
			assert.strictEqual(addedEvents.length, 1);

			// Now Rozenite is gone
			chromeStub.configure.setScriptingResult(null);
			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });
			assert.strictEqual(removedEvents.length, 1);
		});

		it('adds page with correct structure', async () => {
			const pm = createPageManager('TestApp');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'MyApp', reactNativeVersion: '0.73.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-123', tabId: 1 }]);
			chromeStub.configure.setTabData(1, { title: 'My Page' });

			const addedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/test', frameId: 0 });

			assert.strictEqual(addedEvents.length, 1);
			const page = addedEvents[0];
			assert.strictEqual(page.id, 'target-123');
			assert.strictEqual(page.tabId, 1);
			assert.strictEqual(page.title, 'React Native Web (Unknown Browser)');
			assert.strictEqual(page.origin, 'localhost:8081');
			assert.strictEqual(page.app, 'TestApp');
			assert.deepStrictEqual(page.reactNativeMetadata, { appDisplayName: 'MyApp', reactNativeVersion: '0.73.0' });
			assert.deepStrictEqual(page.capabilities, {
				nativePageReloads: true,
				nativeSourceCodeFetching: true,
				prefersFuseboxFrontend: true,
				supportsMultipleDebuggers: false,
			});
		});

		it('updates existing page when same tab updates', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'App1', reactNativeVersion: '0.73.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);
			chromeStub.configure.setTabData(1, { title: 'Title 1' });

			const addedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });
			assert.strictEqual(addedEvents.length, 1);

			// Update with new metadata
			chromeStub.configure.setScriptingResult({ appDisplayName: 'App2', reactNativeVersion: '0.74.0' });
			chromeStub.configure.setTabData(1, { title: 'Title 2' });
			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/other', frameId: 0 });

			// Should not emit another 'added' for same origin
			assert.strictEqual(addedEvents.length, 1);

			const pages = pm.getAll();
			assert.strictEqual(pages.length, 1);
			assert.strictEqual(pages[0].title, 'React Native Web (Unknown Browser)');
			assert.strictEqual(pages[0].reactNativeMetadata.appDisplayName, 'App2');
		});

		it('emits removed and added when origin changes', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);
			chromeStub.configure.setTabData(1, { title: 'Test' });

			const addedEvents = [];
			const removedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));
			pm.on('removed', (page) => removedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });
			assert.strictEqual(addedEvents.length, 1);
			assert.strictEqual(addedEvents[0].origin, 'localhost:8081');

			// Navigate to different origin
			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:3000/', frameId: 0 });

			assert.strictEqual(removedEvents.length, 1);
			assert.strictEqual(removedEvents[0].origin, 'localhost:8081');
			assert.strictEqual(addedEvents.length, 2);
			assert.strictEqual(addedEvents[1].origin, 'localhost:3000');
		});

		it('does not crash when debugger.getTargets fails', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setTabData(1, { title: 'Test' });
			chromeStub.debugger.getTargets = async () => {
				throw new Error('Failed to get targets');
			};

			const addedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));

			// Should not throw
			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });

			assert.strictEqual(addedEvents.length, 0);
		});

		it('does not add page when target not found', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([]); // No targets
			chromeStub.configure.setTabData(1, { title: 'Test' });

			const addedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });

			assert.strictEqual(addedEvents.length, 0);
		});
	});

	describe('onTabRemoved', () => {
		it('removes page and emits removed event', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);
			chromeStub.configure.setTabData(1, { title: 'Test' });

			const addedEvents = [];
			const removedEvents = [];
			pm.on('added', (page) => addedEvents.push(page));
			pm.on('removed', (page) => removedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });
			assert.strictEqual(addedEvents.length, 1);

			pm.onTabRemoved(1);

			assert.strictEqual(removedEvents.length, 1);
			assert.strictEqual(removedEvents[0].tabId, 1);
			assert.strictEqual(pm.getAll().length, 0);
		});

		it('does nothing when removing non-existent tab', () => {
			const pm = createPageManager('');

			const removedEvents = [];
			pm.on('removed', (page) => removedEvents.push(page));

			pm.onTabRemoved(999); // Non-existent tab

			assert.strictEqual(removedEvents.length, 0);
		});
	});

	describe('getByOrigin', () => {
		it('returns pages for specific origin', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([
				{ id: 'target-1', tabId: 1 },
				{ id: 'target-2', tabId: 2 },
				{ id: 'target-3', tabId: 3 },
			]);
			chromeStub.configure.setTabData(1, { title: 'Test 1' });
			chromeStub.configure.setTabData(2, { title: 'Test 2' });
			chromeStub.configure.setTabData(3, { title: 'Test 3' });

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });
			await pm.onNavigationCompleted({ tabId: 2, url: 'http://localhost:8081/other', frameId: 0 });
			await pm.onNavigationCompleted({ tabId: 3, url: 'http://localhost:3000/', frameId: 0 });

			const pages8081 = pm.getByOrigin('localhost:8081');
			const pages3000 = pm.getByOrigin('localhost:3000');

			assert.strictEqual(pages8081.length, 2);
			assert.strictEqual(pages3000.length, 1);
		});

		it('returns empty array for non-existent origin', () => {
			const pm = createPageManager('');
			const pages = pm.getByOrigin('localhost:9999');
			assert.deepStrictEqual(pages, []);
		});
	});

	describe('hasPagesForOrigin', () => {
		it('returns true when origin has pages', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);
			chromeStub.configure.setTabData(1, { title: 'Test' });

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });

			assert.strictEqual(pm.hasPagesForOrigin('localhost:8081'), true);
		});

		it('returns false when origin has no pages', () => {
			const pm = createPageManager('');
			assert.strictEqual(pm.hasPagesForOrigin('localhost:9999'), false);
		});
	});

	describe('hasPages', () => {
		it('returns true when pages exist', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);
			chromeStub.configure.setTabData(1, { title: 'Test' });

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });

			assert.strictEqual(pm.hasPages(), true);
		});

		it('returns false when no pages exist', () => {
			const pm = createPageManager('');
			assert.strictEqual(pm.hasPages(), false);
		});
	});

	describe('remove', () => {
		it('removes page by ID', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);
			chromeStub.configure.setTabData(1, { title: 'Test' });

			const removedEvents = [];
			pm.on('removed', (page) => removedEvents.push(page));

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });

			pm.remove('target-1');

			assert.strictEqual(removedEvents.length, 1);
			assert.strictEqual(removedEvents[0].id, 'target-1');
			assert.strictEqual(pm.getAll().length, 0);
		});

		it('does nothing when removing non-existent page ID', () => {
			const pm = createPageManager('');

			const removedEvents = [];
			pm.on('removed', (page) => removedEvents.push(page));

			pm.remove('nonexistent');

			assert.strictEqual(removedEvents.length, 0);
		});
	});

	describe('clear', () => {
		it('clears all pages', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([
				{ id: 'target-1', tabId: 1 },
				{ id: 'target-2', tabId: 2 },
			]);
			chromeStub.configure.setTabData(1, { title: 'Test 1' });
			chromeStub.configure.setTabData(2, { title: 'Test 2' });

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });
			await pm.onNavigationCompleted({ tabId: 2, url: 'http://localhost:3000/', frameId: 0 });

			assert.strictEqual(pm.getAll().length, 2);

			pm.clear();

			assert.strictEqual(pm.getAll().length, 0);
		});
	});

	describe('getAll', () => {
		it('returns copy of pages array', async () => {
			const pm = createPageManager('');
			chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
			chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);
			chromeStub.configure.setTabData(1, { title: 'Test' });

			await pm.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });

			const pages1 = pm.getAll();
			const pages2 = pm.getAll();

			assert.notStrictEqual(pages1, pages2, 'Should return different array instances');
			assert.deepStrictEqual(pages1, pages2, 'But with same content');
		});
	});
});
