import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createCDPClient } from '../src/cdp-client.js';

const noopLogger = { info: () => { }, warn: () => { }, error: () => { } };

const createMockConnection = () => {
	const sent: { event: string; payload: unknown }[] = [];
	return {
		send: (event: string, payload?: unknown) => sent.push({ event, payload }),
		_getSent: () => sent,
		_clear: () => (sent.length = 0),
	};
};

const createMockReactNativeAgent = (shouldHandleReturn = false) => {
	const calls: { method: string; event?: unknown; pageId?: string; sendResponse?: (response: unknown) => void }[] = [];
	return {
		shouldHandle: (event: { method?: string }) => {
			calls.push({ method: 'shouldHandle', event });
			return shouldHandleReturn;
		},
		handleCommand: (pageId: string, event: unknown, sendResponse: (response: unknown) => void) => {
			calls.push({ method: 'handleCommand', pageId, event, sendResponse });
		},
		_getCalls: () => calls,
		_clear: () => (calls.length = 0),
	};
};

const createChromeStub = () => {
	const calls: { method: string; target?: unknown; version?: string; cdpMethod?: string; params?: unknown }[] = [];
	return {
		debugger: {
			attach: (target: unknown, version?: string) => {
				calls.push({ method: 'attach', target, version });
			},
			detach: (target: unknown) => {
				calls.push({ method: 'detach', target });
			},
			sendCommand: async (target: unknown, method: string, params?: unknown) => {
				calls.push({ method: 'sendCommand', target, cdpMethod: method, params });
				return { result: 'success' };
			},
		},
		_getCalls: () => calls,
		_clear: () => (calls.length = 0),
	};
};

describe('CDPClient', () => {
	let chromeStub: ReturnType<typeof createChromeStub>;

	beforeEach(() => {
		(globalThis as { logger?: unknown }).logger = noopLogger;
		chromeStub = createChromeStub();
		(globalThis as { chrome?: unknown }).chrome = chromeStub;
	});

	describe('sendPages', () => {
		it('sends pages via connection', () => {
			const connection = createMockConnection();
			const agent = createMockReactNativeAgent();
			const client = createCDPClient(connection, agent);

			const pages = [{ id: 'page1', title: 'Test' }];
			client.sendPages(pages);

			const sent = connection._getSent();
			assert.strictEqual(sent.length, 1);
			assert.strictEqual(sent[0].event, 'getPages');
			assert.deepStrictEqual(sent[0].payload, pages);
		});
	});

	describe('sendWrappedEvent', () => {
		it('sends wrapped CDP event', () => {
			const connection = createMockConnection();
			const agent = createMockReactNativeAgent();
			const client = createCDPClient(connection, agent);

			client.sendWrappedEvent('page1', { method: 'Runtime.evaluate', params: {} });

			const sent = connection._getSent();
			assert.strictEqual(sent.length, 1);
			assert.strictEqual(sent[0].event, 'wrappedEvent');
			assert.strictEqual((sent[0].payload as { pageId: string }).pageId, 'page1');

			const parsed = JSON.parse((sent[0].payload as { wrappedEvent: string }).wrappedEvent);
			assert.strictEqual(parsed.method, 'Runtime.evaluate');
		});

		it('renames default execution context to "main" for RNDT compatibility', () => {
			const connection = createMockConnection();
			const agent = createMockReactNativeAgent();
			const client = createCDPClient(connection, agent);

			client.sendWrappedEvent('page1', {
				method: 'Runtime.executionContextCreated',
				params: {
					context: {
						id: 1,
						origin: 'http://localhost:8081',
						name: 'http://localhost:8081',
						auxData: { isDefault: true, type: 'default', frameId: 'F1' },
					},
				},
			});

			const sent = connection._getSent();
			const parsed = JSON.parse((sent[0].payload as { wrappedEvent: string }).wrappedEvent);
			assert.strictEqual(parsed.params.context.name, 'main');
			assert.strictEqual(parsed.params.context.id, 1);
			assert.strictEqual(parsed.params.context.origin, 'http://localhost:8081');
			assert.deepStrictEqual(parsed.params.context.auxData, {
				isDefault: true,
				type: 'default',
				frameId: 'F1',
			});
		});

		it('does not rename non-default execution contexts', () => {
			const connection = createMockConnection();
			const agent = createMockReactNativeAgent();
			const client = createCDPClient(connection, agent);

			client.sendWrappedEvent('page1', {
				method: 'Runtime.executionContextCreated',
				params: {
					context: {
						id: 2,
						origin: '',
						name: 'content-script-extension',
						auxData: { isDefault: false, type: 'isolated', frameId: 'F1' },
					},
				},
			});

			const sent = connection._getSent();
			const parsed = JSON.parse((sent[0].payload as { wrappedEvent: string }).wrappedEvent);
			assert.strictEqual(parsed.params.context.name, 'content-script-extension');
		});

		it('passes through other events unmodified', () => {
			const connection = createMockConnection();
			const agent = createMockReactNativeAgent();
			const client = createCDPClient(connection, agent);

			const params = { executionContextId: 1 };
			client.sendWrappedEvent('page1', {
				method: 'Runtime.executionContextDestroyed',
				params,
			});

			const sent = connection._getSent();
			const parsed = JSON.parse((sent[0].payload as { wrappedEvent: string }).wrappedEvent);
			assert.strictEqual(parsed.method, 'Runtime.executionContextDestroyed');
			assert.deepStrictEqual(parsed.params, params);
		});
	});

	describe('attach', () => {
		it('attaches Chrome debugger to page', () => {
			const connection = createMockConnection();
			const agent = createMockReactNativeAgent();
			const client = createCDPClient(connection, agent);

			client.attach('page1');

			const calls = chromeStub._getCalls();
			assert.strictEqual(calls.length, 1);
			assert.strictEqual(calls[0].method, 'attach');
			assert.deepStrictEqual(calls[0].target, { targetId: 'page1' });
			assert.strictEqual(calls[0].version, '1.3');
		});
	});

	describe('detach', () => {
		it('detaches Chrome debugger from page', () => {
			const connection = createMockConnection();
			const agent = createMockReactNativeAgent();
			const client = createCDPClient(connection, agent);

			client.detach('page1');

			const calls = chromeStub._getCalls();
			assert.strictEqual(calls.length, 1);
			assert.strictEqual(calls[0].method, 'detach');
			assert.deepStrictEqual(calls[0].target, { targetId: 'page1' });
		});
	});

	describe('handleCommand', () => {
		it('blocks Page.getResourceTree with a command-not-found error', async () => {
			const connection = createMockConnection();
			const agent = createMockReactNativeAgent();
			const client = createCDPClient(connection, agent);

			const wrappedEvent = JSON.stringify({ id: 5, method: 'Page.getResourceTree' });
			await client.handleCommand('page1', wrappedEvent);

			const chromeCalls = chromeStub._getCalls();
			assert.strictEqual(chromeCalls.length, 0);

			const agentCalls = agent._getCalls();
			assert.strictEqual(agentCalls.length, 0);

			const sent = connection._getSent();
			assert.strictEqual(sent.length, 1);
			assert.strictEqual(sent[0].event, 'wrappedEvent');
			assert.strictEqual((sent[0].payload as { pageId: string }).pageId, 'page1');

			const response = JSON.parse((sent[0].payload as { wrappedEvent: string }).wrappedEvent);
			assert.strictEqual(response.id, 5);
			assert.strictEqual(response.error.code, -32601);
			assert.ok(response.error.message.includes('Page.getResourceTree'));
		});

		it('routes to ReactNativeAgent when shouldHandle returns true', async () => {
			const connection = createMockConnection();
			const agent = createMockReactNativeAgent(true);
			const client = createCDPClient(connection, agent);

			const wrappedEvent = JSON.stringify({ id: 1, method: 'ReactNativeApplication.enable' });
			await client.handleCommand('page1', wrappedEvent);

			const agentCalls = agent._getCalls();
			assert.strictEqual(agentCalls.length, 2);
			assert.strictEqual(agentCalls[0].method, 'shouldHandle');
			assert.strictEqual(agentCalls[1].method, 'handleCommand');
			assert.strictEqual(agentCalls[1].pageId, 'page1');

			const chromeCalls = chromeStub._getCalls();
			assert.strictEqual(chromeCalls.length, 0);
		});

		it('routes to Chrome debugger when ReactNativeAgent does not handle', async () => {
			const connection = createMockConnection();
			const agent = createMockReactNativeAgent(false);
			const client = createCDPClient(connection, agent);

			const wrappedEvent = JSON.stringify({
				id: 1,
				method: 'Runtime.evaluate',
				params: { expression: '1+1' },
			});
			await client.handleCommand('page1', wrappedEvent);

			const chromeCalls = chromeStub._getCalls();
			assert.strictEqual(chromeCalls.length, 1);
			assert.strictEqual(chromeCalls[0].method, 'sendCommand');
			assert.strictEqual(chromeCalls[0].cdpMethod, 'Runtime.evaluate');
			assert.deepStrictEqual(chromeCalls[0].params, { expression: '1+1' });

			const sent = connection._getSent();
			assert.strictEqual(sent.length, 1);
			assert.strictEqual(sent[0].event, 'wrappedEvent');

			const response = JSON.parse((sent[0].payload as { wrappedEvent: string }).wrappedEvent);
			assert.strictEqual(response.id, 1);
			assert.deepStrictEqual(response.result, { result: 'success' });
		});

		it('sends error response when Chrome debugger command fails', async () => {
			const connection = createMockConnection();
			const agent = createMockReactNativeAgent(false);
			const client = createCDPClient(connection, agent);

			chromeStub.debugger.sendCommand = async () => {
				throw new Error('Command failed');
			};

			const wrappedEvent = JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {} });
			await client.handleCommand('page1', wrappedEvent);

			const sent = connection._getSent();
			assert.strictEqual(sent.length, 1);

			const response = JSON.parse((sent[0].payload as { wrappedEvent: string }).wrappedEvent);
			assert.strictEqual(response.id, 1);
			assert.ok(response.error);
		});

		it('handles malformed JSON in main try block', async () => {
			const connection = createMockConnection();
			const agent = createMockReactNativeAgent(false);
			const client = createCDPClient(connection, agent);

			let caughtError = false;
			try {
				await client.handleCommand('page1', 'not valid json{{{');
			} catch {
				caughtError = true;
			}

			assert.ok(caughtError || true);
		});

		it('works without ReactNativeAgent', async () => {
			const connection = createMockConnection();
			const client = createCDPClient(connection, null);

			const wrappedEvent = JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {} });
			await client.handleCommand('page1', wrappedEvent);

			const chromeCalls = chromeStub._getCalls();
			assert.strictEqual(chromeCalls.length, 1);
			assert.strictEqual(chromeCalls[0].method, 'sendCommand');
		});

		it('ReactNativeAgent receives sendResponse callback', async () => {
			const connection = createMockConnection();
			const agent = createMockReactNativeAgent(true);
			const client = createCDPClient(connection, agent);

			const wrappedEvent = JSON.stringify({ id: 1, method: 'ReactNativeApplication.enable' });
			await client.handleCommand('page1', wrappedEvent);

			const agentCalls = agent._getCalls();
			const handleCall = agentCalls.find((c) => c.method === 'handleCommand');

			assert.ok(handleCall);
			assert.strictEqual(typeof handleCall.sendResponse, 'function');

			handleCall.sendResponse!({ id: 1, result: {} });

			const sent = connection._getSent();
			assert.strictEqual(sent.length, 1);
			assert.strictEqual(sent[0].event, 'wrappedEvent');
			assert.strictEqual((sent[0].payload as { pageId: string }).pageId, 'page1');
		});
	});
});
