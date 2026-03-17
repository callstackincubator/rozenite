import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createExtension } from '../src/extension.js';
import { createConnection } from '../src/connection.js';
import { createCDPClient } from '../src/cdp-client.js';
import { createPageManager } from '../src/page-manager.js';
import { createReactNativeAgent } from '../src/react-native-agent.js';
import { getDeviceName } from '../src/device-utils.js';
import { FakeWebSocket, createChromeStub } from './stubs.js';

const noopLogger = { info: () => { }, warn: () => { }, error: () => { } };

const createExtensionWithStubs = (chromeStub: ReturnType<typeof createChromeStub>) => {
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	(globalThis as { chrome?: unknown }).chrome = chromeStub;

	return createExtension({
		createConnection,
		createCDPClient,
		createPageManager,
		createReactNativeAgent,
		getDeviceName,
		browserId: 'test-browser-id',
		logger: noopLogger,
	});
};

const simulatePageAdded = async (
	ext: ReturnType<typeof createExtensionWithStubs>,
	tabId: number,
	url: string,
	targetId = `target-${tabId}`
) => {
	; (globalThis as { chrome?: ReturnType<typeof createChromeStub> }).chrome!.configure.setDebuggerTargets([
		{ id: targetId, tabId },
	]);
	; (globalThis as { chrome?: ReturnType<typeof createChromeStub> }).chrome!.configure.setTabData(tabId, {
		title: 'Test',
	});
	await ext.pageManager.onNavigationCompleted({ tabId, url, frameId: 0 });
};

const wireChromeListeners = (ext: ReturnType<typeof createExtensionWithStubs>) => {
	; (globalThis as { chrome?: ReturnType<typeof createChromeStub> }).chrome!.webNavigation.onCompleted.addListener(
		(...args: unknown[]) => ext.pageManager.onNavigationCompleted(args[0] as Parameters<typeof ext.pageManager.onNavigationCompleted>[0])
	);
	; (globalThis as { chrome?: ReturnType<typeof createChromeStub> }).chrome!.tabs.onRemoved.addListener(
		(tabId: number) => ext.pageManager.onTabRemoved(tabId)
	);
};

const simulateTabRemoved = (tabId: number) => {
	const listeners = (globalThis as { chrome?: ReturnType<typeof createChromeStub> }).chrome!.getListeners();
	listeners.tabsOnRemoved?.(tabId);
};

describe('Extension integration', () => {
	let chromeStub: ReturnType<typeof createChromeStub>;

	beforeEach(() => {
		FakeWebSocket.reset();
		chromeStub = createChromeStub();
		chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
	});

	afterEach(() => {
		delete (globalThis as { WebSocket?: unknown }).WebSocket;
		delete (globalThis as { chrome?: unknown }).chrome;
	});

	it('no socket before page added', () => {
		createExtensionWithStubs(chromeStub);
		assert.strictEqual(FakeWebSocket.instances.length, 0, 'No WebSocket should be created at init');
	});

	it('socket created on first page', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		await simulatePageAdded(ext, 1, 'http://localhost:8081/');

		assert.strictEqual(FakeWebSocket.instances.length, 1, 'Exactly one WebSocket should be created');
		assert.ok(
			FakeWebSocket.instances[0].url.includes('localhost:8081'),
			'WebSocket URL should contain localhost:8081'
		);
	});

	it('same origin reuses socket', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		chromeStub.configure.setDebuggerTargets([
			{ id: 'target-1', tabId: 1 },
			{ id: 'target-2', tabId: 2 },
		]);

		chromeStub.configure.setTabData(1, { title: 'Test' });
		chromeStub.configure.setTabData(2, { title: 'Test 2' });
		await ext.pageManager.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });
		await ext.pageManager.onNavigationCompleted({ tabId: 2, url: 'http://localhost:8081/other', frameId: 0 });

		assert.strictEqual(FakeWebSocket.instances.length, 1, 'Same origin should reuse single WebSocket');
	});

	it('different origin gets its own socket', async () => {
		const ext = createExtensionWithStubs(chromeStub);

		await simulatePageAdded(ext, 1, 'http://localhost:8081/');
		await simulatePageAdded(ext, 2, 'http://localhost:3000/');

		assert.strictEqual(
			FakeWebSocket.instances.length,
			2,
			'Different origins should have separate WebSockets'
		);
		const urls = FakeWebSocket.instances.map((ws) => ws.url);
		assert.ok(urls.some((u) => u.includes('localhost:8081')), 'One socket for 8081');
		assert.ok(urls.some((u) => u.includes('localhost:3000')), 'One socket for 3000');
	});

	it('socket closed when last page removed', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		wireChromeListeners(ext);

		await simulatePageAdded(ext, 1, 'http://localhost:8081/');
		await simulatePageAdded(ext, 2, 'http://localhost:3000/');

		const ws8081 = FakeWebSocket.instances.find((ws) => ws.url.includes('8081'));
		const ws3000 = FakeWebSocket.instances.find((ws) => ws.url.includes('3000'));

		simulateTabRemoved(1);

		assert.ok(ws8081!._closed, 'WebSocket for 8081 should be closed');
		assert.ok(!ws3000!._closed, 'WebSocket for 3000 should remain open');
	});

	it('socket survives partial removal', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		wireChromeListeners(ext);
		chromeStub.configure.setDebuggerTargets([
			{ id: 'target-1', tabId: 1 },
			{ id: 'target-2', tabId: 2 },
		]);

		chromeStub.configure.setTabData(1, { title: 'Test' });
		chromeStub.configure.setTabData(2, { title: 'Test 2' });
		await ext.pageManager.onNavigationCompleted({ tabId: 1, url: 'http://localhost:8081/', frameId: 0 });
		await ext.pageManager.onNavigationCompleted({ tabId: 2, url: 'http://localhost:8081/other', frameId: 0 });

		const ws = FakeWebSocket.instances[0];
		simulateTabRemoved(1);

		assert.ok(!ws._closed, 'WebSocket should remain open when one of two pages removed');
	});
});
