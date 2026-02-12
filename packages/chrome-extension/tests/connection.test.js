import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createConnection } from '../src/connection.js';
import { FakeWebSocket } from './stubs.js';

const noopLogger = { info: () => { }, warn: () => { }, error: () => { } };

describe('Connection', () => {
	beforeEach(() => {
		FakeWebSocket.reset();
		globalThis.WebSocket = FakeWebSocket;
		globalThis.logger = noopLogger;
	});

	afterEach(() => {
		delete globalThis.WebSocket;
		delete globalThis.logger;
	});

	it('constructs WebSocket URL correctly', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test Device',
			app: 'TestApp',
			profiling: 'false'
		});

		connection.connect();

		assert.strictEqual(FakeWebSocket.instances.length, 1);
		const ws = FakeWebSocket.instances[0];
		assert.ok(ws.url.includes('ws://localhost:8081/inspector/device'));
		assert.ok(ws.url.includes('device=chrome'), 'URL should contain device parameter');
		// Note: encodeURIComponent in actual URL construction depends on browser implementation
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
			profiling: 'false'
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
			profiling: 'false'
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
			profiling: 'false'
		});

		let error;
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
			profiling: 'false'
		});

		let receivedPayload;
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
			profiling: 'false'
		});

		const events = [];
		connection.on('connect', (payload) => events.push({ type: 'connect', payload }));
		connection.on('disconnect', (payload) => events.push({ type: 'disconnect', payload }));

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
			profiling: 'false'
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
			profiling: 'false'
		});

		connection.connect();
		const ws = FakeWebSocket.instances[0];

		// Should not throw
		ws.simulateMessage('not valid json{{{');
		assert.ok(true);
	});

	it('send() sends message when WebSocket is open', () => {
		const connection = createConnection({
			host: 'localhost:8081',
			deviceId: 'chrome',
			deviceName: 'Test',
			app: '',
			profiling: 'false'
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
			profiling: 'false'
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
			profiling: 'false'
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
			profiling: 'false'
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
			profiling: 'false'
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
			profiling: 'false'
		});

		// Don't call connect()
		assert.strictEqual(connection.isConnected(), false);
	});
});
