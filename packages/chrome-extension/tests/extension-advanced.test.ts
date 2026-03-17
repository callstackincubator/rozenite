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

const simulatePageRefresh = async (
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

describe('Extension message-driven flows', () => {
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

	it('handles getPages message from server', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		await simulatePageAdded(ext, 1, 'http://localhost:8081/');

		const ws = FakeWebSocket.instances[0];
		ws.simulateMessage({ event: 'getPages', payload: {} });

		assert.ok(ws._sent.length > 0);
		const lastMessage = JSON.parse(ws._sent[ws._sent.length - 1]);
		assert.strictEqual(lastMessage.event, 'getPages');
		assert.ok(Array.isArray(lastMessage.payload));
	});

	it('handles connect message and attaches debugger', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		await simulatePageAdded(ext, 1, 'http://localhost:8081/', 'page-123');

		const attachCalls: { target: unknown; version?: string }[] = [];
		chromeStub.debugger.attach = (target: unknown, version?: string) => {
			attachCalls.push({ target, version });
		};

		const ws = FakeWebSocket.instances[0];
		ws.simulateMessage({ event: 'connect', payload: { pageId: 'page-123' } });

		assert.strictEqual(attachCalls.length, 1);
		assert.deepStrictEqual(attachCalls[0].target, { targetId: 'page-123' });
	});

	it('handles disconnect message and detaches debugger', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		await simulatePageAdded(ext, 1, 'http://localhost:8081/', 'page-123');

		const detachCalls: { target: unknown }[] = [];
		chromeStub.debugger.detach = (target: unknown) => {
			detachCalls.push({ target });
		};

		const ws = FakeWebSocket.instances[0];
		ws.simulateMessage({ event: 'disconnect', payload: { pageId: 'page-123' } });

		assert.strictEqual(detachCalls.length, 1);
		assert.deepStrictEqual(detachCalls[0].target, { targetId: 'page-123' });
	});

	it('handles wrappedEvent message and forwards to Chrome debugger', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		await simulatePageAdded(ext, 1, 'http://localhost:8081/', 'page-123');

		const sendCommandCalls: { target: unknown; method: string; params?: unknown }[] = [];
		chromeStub.debugger.sendCommand = async (
			target: unknown,
			method: string,
			params?: unknown
		) => {
			sendCommandCalls.push({ target, method, params });
			return { value: 42 };
		};

		const ws = FakeWebSocket.instances[0];
		const command = JSON.stringify({
			id: 1,
			method: 'Runtime.evaluate',
			params: { expression: '1+1' },
		});
		ws.simulateMessage({
			event: 'wrappedEvent',
			payload: { pageId: 'page-123', wrappedEvent: command },
		});

		await new Promise((resolve) => setTimeout(resolve, 0));

		assert.strictEqual(sendCommandCalls.length, 1);
		assert.strictEqual(sendCommandCalls[0].method, 'Runtime.evaluate');
	});

	it('routes ReactNativeApplication commands to agent', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		await simulatePageAdded(ext, 1, 'http://localhost:8081/', 'page-123');

		const ws = FakeWebSocket.instances[0];
		const initialSentCount = ws._sent.length;

		const command = JSON.stringify({ id: 1, method: 'ReactNativeApplication.enable' });
		ws.simulateMessage({ event: 'wrappedEvent', payload: { pageId: 'page-123', wrappedEvent: command } });

		await new Promise((resolve) => setTimeout(resolve, 0));

		assert.ok(ws._sent.length > initialSentCount, 'Response should be sent');

		const responses = ws._sent.slice(initialSentCount).map((msg) => JSON.parse(msg));
		const wrappedResponses = responses.filter(
			(r: { event: string }) => r.event === 'wrappedEvent'
		);
		assert.ok(wrappedResponses.length > 0, 'Should have wrapped event responses');
	});
});

describe('Extension edge cases', () => {
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

	it('recreates socket after all pages removed and new page added', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		await simulatePageAdded(ext, 1, 'http://localhost:8081/');

		assert.strictEqual(FakeWebSocket.instances.length, 1);
		const firstWs = FakeWebSocket.instances[0];

		ext.pageManager.onTabRemoved(1);
		assert.strictEqual(firstWs._closed, true);

		await simulatePageAdded(ext, 2, 'http://localhost:8081/');

		assert.strictEqual(FakeWebSocket.instances.length, 2, 'New WebSocket should be created');
		const secondWs = FakeWebSocket.instances[1];
		assert.notStrictEqual(firstWs, secondWs);
		assert.strictEqual(secondWs._closed, false);
	});

	it('handles tab navigating between inspectable origins', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);

		chromeStub.configure.setTabData(1, { title: 'Test' });
		await ext.pageManager.onNavigationCompleted({
			tabId: 1,
			url: 'http://localhost:8081/',
			frameId: 0,
		});
		assert.strictEqual(FakeWebSocket.instances.length, 1);

		await ext.pageManager.onNavigationCompleted({
			tabId: 1,
			url: 'http://localhost:3000/',
			frameId: 0,
		});

		assert.strictEqual(FakeWebSocket.instances.length, 2);

		const ws8081 = FakeWebSocket.instances.find((ws) => ws.url.includes('8081'));
		const ws3000 = FakeWebSocket.instances.find((ws) => ws.url.includes('3000'));

		assert.ok(ws8081, 'Socket for 8081 should exist');
		assert.ok(ws3000, 'Socket for 3000 should exist');
		assert.strictEqual(ws3000!._closed, false, 'New socket should be open');
	});

	it('handles tab navigating to non-inspectable URL', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		chromeStub.configure.setDebuggerTargets([{ id: 'target-1', tabId: 1 }]);

		chromeStub.configure.setTabData(1, { title: 'Test' });
		await ext.pageManager.onNavigationCompleted({
			tabId: 1,
			url: 'http://localhost:8081/',
			frameId: 0,
		});
		const ws = FakeWebSocket.instances[0];

		await ext.pageManager.onNavigationCompleted({
			tabId: 1,
			url: 'https://example.com/',
			frameId: 0,
		});

		assert.strictEqual(ws._closed, true);
		assert.strictEqual(ext.groups.size, 0, 'Connection group should be removed');
	});

	it('removeGroup does nothing for non-existent origin', () => {
		const ext = createExtensionWithStubs(chromeStub);
		ext.removeGroup('nonexistent:9999');
		assert.ok(true);
	});

	it('getOrCreateGroup returns same group for same origin', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		await simulatePageAdded(ext, 1, 'http://localhost:8081/');

		const group1 = ext.getOrCreateGroup('localhost:8081');
		const group2 = ext.getOrCreateGroup('localhost:8081');

		assert.strictEqual(group1, group2, 'Should return same group instance');
		assert.strictEqual(FakeWebSocket.instances.length, 1, 'Should not create duplicate sockets');
	});

	it('handles multiple tabs on same origin added simultaneously', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		chromeStub.configure.setDebuggerTargets([
			{ id: 'target-1', tabId: 1 },
			{ id: 'target-2', tabId: 2 },
			{ id: 'target-3', tabId: 3 },
		]);

		chromeStub.configure.setTabData(1, { title: 'A' });
		chromeStub.configure.setTabData(2, { title: 'B' });
		chromeStub.configure.setTabData(3, { title: 'C' });

		const promises = [
			ext.pageManager.onNavigationCompleted({
				tabId: 1,
				url: 'http://localhost:8081/a',
				frameId: 0,
			}),
			ext.pageManager.onNavigationCompleted({
				tabId: 2,
				url: 'http://localhost:8081/b',
				frameId: 0,
			}),
			ext.pageManager.onNavigationCompleted({
				tabId: 3,
				url: 'http://localhost:8081/c',
				frameId: 0,
			}),
		];

		await Promise.all(promises);

		assert.strictEqual(FakeWebSocket.instances.length, 1, 'Should only create one socket');
		assert.strictEqual(
			ext.pageManager.getByOrigin('localhost:8081').length,
			3,
			'All pages should be tracked'
		);
	});

	it('maintains separate groups for different origins', async () => {
		const ext = createExtensionWithStubs(chromeStub);

		await simulatePageAdded(ext, 1, 'http://localhost:8081/');
		await simulatePageAdded(ext, 2, 'http://localhost:3000/');
		await simulatePageAdded(ext, 3, 'http://localhost:4000/');

		assert.strictEqual(ext.groups.size, 3);
		assert.ok(ext.groups.has('localhost:8081'));
		assert.ok(ext.groups.has('localhost:3000'));
		assert.ok(ext.groups.has('localhost:4000'));
	});

	it('cleans up correct group when one of multiple origins removed', async () => {
		const ext = createExtensionWithStubs(chromeStub);

		await simulatePageAdded(ext, 1, 'http://localhost:8081/');
		await simulatePageAdded(ext, 2, 'http://localhost:3000/');

		const ws8081 = FakeWebSocket.instances.find((ws) => ws.url.includes('8081'));
		const ws3000 = FakeWebSocket.instances.find((ws) => ws.url.includes('3000'));

		ext.pageManager.onTabRemoved(1);

		assert.strictEqual(ws8081!._closed, true);
		assert.strictEqual(ws3000!._closed, false);
		assert.strictEqual(ext.groups.size, 1);
		assert.ok(!ext.groups.has('localhost:8081'));
		assert.ok(ext.groups.has('localhost:3000'));
	});
});

describe('WebSocket reconnection heartbeat', () => {
	let chromeStub: ReturnType<typeof createChromeStub>;

	beforeEach(() => {
		FakeWebSocket.reset();
		FakeWebSocket.simulateConnectFailureForNext = false;
		chromeStub = createChromeStub();
		chromeStub.configure.setScriptingResult({ appDisplayName: 'Test', reactNativeVersion: '0.0.0' });
	});

	afterEach(() => {
		delete (globalThis as { WebSocket?: unknown }).WebSocket;
		delete (globalThis as { chrome?: unknown }).chrome;
	});

	it('reconnects when page refreshed after Metro restart', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		await simulatePageAdded(ext, 1, 'http://localhost:8081/', 'target-1');

		assert.strictEqual(FakeWebSocket.instances.length, 1);
		const firstWs = FakeWebSocket.instances[0];

		firstWs.close();

		await simulatePageRefresh(ext, 1, 'http://localhost:8081/', 'target-1');

		assert.strictEqual(
			FakeWebSocket.instances.length,
			2,
			'New WebSocket should be created on refresh'
		);
		const secondWs = FakeWebSocket.instances[1];
		assert.strictEqual(secondWs._closed, false, 'New WebSocket should be open');
	});

	it('does not create new socket when connection is alive on refresh', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		await simulatePageAdded(ext, 1, 'http://localhost:8081/', 'target-1');

		assert.strictEqual(FakeWebSocket.instances.length, 1);

		await simulatePageRefresh(ext, 1, 'http://localhost:8081/', 'target-1');

		assert.strictEqual(
			FakeWebSocket.instances.length,
			1,
			'Should not create duplicate socket when connection is alive'
		);
	});

	it('gracefully handles failed reconnection and retries on next refresh', async () => {
		const ext = createExtensionWithStubs(chromeStub);
		await simulatePageAdded(ext, 1, 'http://localhost:8081/', 'target-1');

		const firstWs = FakeWebSocket.instances[0];
		firstWs.close();

		FakeWebSocket.simulateConnectFailureForNext = true;
		await simulatePageRefresh(ext, 1, 'http://localhost:8081/', 'target-1');

		assert.strictEqual(ext.groups.size, 1);
		assert.strictEqual(FakeWebSocket.instances.length, 2);

		FakeWebSocket.simulateConnectFailureForNext = false;
		await simulatePageRefresh(ext, 1, 'http://localhost:8081/', 'target-1');

		assert.strictEqual(FakeWebSocket.instances.length, 3);
		const thirdWs = FakeWebSocket.instances[2];
		assert.strictEqual(thirdWs._closed, false, 'Third WebSocket should be open');
	});
});
