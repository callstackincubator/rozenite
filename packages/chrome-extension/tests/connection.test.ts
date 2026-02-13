import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createConnection } from '../src/connection.js';
import { FakeWebSocket } from './stubs.js';

const noopLogger = { info: () => { }, warn: () => { }, error: () => { } };

describe('Connection', () => {
	beforeEach(() => {
		FakeWebSocket.reset();
		globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
		(globalThis as { logger?: unknown }).logger = noopLogger;
	});

	afterEach(() => {
		delete (globalThis as { WebSocket?: unknown }).WebSocket;
		delete (globalThis as { logger?: unknown }).logger;
	});

	it('constructs WebSocket URL correctly', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test Device',
			app: 'TestApp',
			profiling: 'false',
		});

		connection.connect();

		assert.strictEqual(FakeWebSocket.instances.length, 1);
		const ws = FakeWebSocket.instances[0];
		assert.ok(ws.url.includes('ws://localhost:8081/inspector/device'));
		assert.ok(ws.url.includes('device=chrome'), 'URL should contain device parameter');
		assert.ok(ws.url.includes('name=') && ws.url.includes('Test'));
		assert.ok(ws.url.includes('app=TestApp'));
		assert.ok(ws.url.includes('profiling=false'));
	});

	it('emits open event when WebSocket opens', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test',
			app: '',
			profiling: 'false',
		});

		let opened = false;
		connection.on('open', () => {
			opened = true;
		});

		connection.connect();
		const ws = FakeWebSocket.instances[0];
		ws.simulateOpen();

		assert.strictEqual(opened, true);
	});

	it('emits close event when WebSocket closes', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test',
			app: '',
			profiling: 'false',
		});

		let closed = false;
		connection.on('close', () => {
			closed = true;
		});

		connection.connect();
		const ws = FakeWebSocket.instances[0];
		ws.close();

		assert.strictEqual(closed, true);
	});

	it('emits error event when WebSocket errors', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test',
			app: '',
			profiling: 'false',
		});

		let error: unknown;
		connection.on('error', (err) => {
			error = err;
		});

		connection.connect();
		const ws = FakeWebSocket.instances[0];
		const testError = new Error('Connection failed');
		ws.simulateError(testError);

		assert.strictEqual(error, testError);
	});

	it('parses and emits typed events from messages', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test',
			app: '',
			profiling: 'false',
		});

		let receivedPayload: unknown;
		connection.on('getPages', (payload) => {
			receivedPayload = payload;
		});

		connection.connect();
		const ws = FakeWebSocket.instances[0];
		ws.simulateMessage({ event: 'getPages', payload: { pages: [] } });

		assert.deepStrictEqual(receivedPayload, { pages: [] });
	});

	it('emits multiple typed events', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test',
			app: '',
			profiling: 'false',
		});

		const events: { type: string; payload: { pageId: string } }[] = [];
		connection.on('connect', (payload) =>
			events.push({ type: 'connect', payload: payload as { pageId: string } })
		);
		connection.on('disconnect', (payload) =>
			events.push({ type: 'disconnect', payload: payload as { pageId: string } })
		);

		connection.connect();
		const ws = FakeWebSocket.instances[0];
		ws.simulateMessage({ event: 'connect', payload: { pageId: 'page1' } });
		ws.simulateMessage({ event: 'disconnect', payload: { pageId: 'page2' } });

		assert.strictEqual(events.length, 2);
		assert.strictEqual(events[0].type, 'connect');
		assert.strictEqual(events[0].payload.pageId, 'page1');
		assert.strictEqual(events[1].type, 'disconnect');
		assert.strictEqual(events[1].payload.pageId, 'page2');
	});

	it('ignores messages without event field', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test',
			app: '',
			profiling: 'false',
		});

		let called = false;
		connection.on('test', () => {
			called = true;
		});

		connection.connect();
		const ws = FakeWebSocket.instances[0];
		ws.simulateMessage({ payload: 'no event field' });

		assert.strictEqual(called, false);
	});

	it('handles invalid JSON gracefully', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test',
			app: '',
			profiling: 'false',
		});

		connection.connect();
		const ws = FakeWebSocket.instances[0];

		ws.simulateMessage('not valid json{{{');
		assert.ok(true);
	});

	it('send() sends message when WebSocket is open', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test',
			app: '',
			profiling: 'false',
		});

		connection.connect();
		const ws = FakeWebSocket.instances[0];
		ws.readyState = FakeWebSocket.OPEN;

		connection.send('testEvent', { data: 'test' });

		assert.strictEqual(ws._sent.length, 1);
		const sent = JSON.parse(ws._sent[0]);
		assert.strictEqual(sent.event, 'testEvent');
		assert.deepStrictEqual(sent.payload, { data: 'test' });
	});

	it('send() does not send when WebSocket is not open', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test',
			app: '',
			profiling: 'false',
		});

		connection.connect();
		const ws = FakeWebSocket.instances[0];
		ws.readyState = FakeWebSocket.CLOSED;

		connection.send('testEvent', { data: 'test' });

		assert.strictEqual(ws._sent.length, 0);
	});

	it('close() closes the WebSocket', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test',
			app: '',
			profiling: 'false',
		});

		connection.connect();
		const ws = FakeWebSocket.instances[0];
		connection.close();

		assert.strictEqual(ws._closed, true);
		assert.strictEqual(ws.readyState, FakeWebSocket.CLOSED);
	});

	it('isConnected() returns true when open', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test',
			app: '',
			profiling: 'false',
		});

		connection.connect();
		const ws = FakeWebSocket.instances[0];
		ws.readyState = FakeWebSocket.OPEN;

		assert.strictEqual(connection.isConnected(), true);
	});

	it('isConnected() returns false when closed', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test',
			app: '',
			profiling: 'false',
		});

		connection.connect();
		const ws = FakeWebSocket.instances[0];
		ws.readyState = FakeWebSocket.CLOSED;

		assert.strictEqual(connection.isConnected(), false);
	});

	it('isConnected() returns false when WebSocket is null', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test',
			app: '',
			profiling: 'false',
		});

		assert.strictEqual(connection.isConnected(), false);
	});
});
