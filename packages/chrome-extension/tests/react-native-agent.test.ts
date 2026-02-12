import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createReactNativeAgent } from '../src/react-native-agent.js';

const noopLogger = { info: () => { }, warn: () => { }, error: () => { } };

const createMockPageManager = (pages: { id: string; reactNativeMetadata?: Record<string, unknown> }[] = []) => {
	return {
		getAll: () => pages,
	};
};

describe('ReactNativeAgent', () => {
	beforeEach(() => {
		(globalThis as { logger?: unknown }).logger = noopLogger;
		globalThis.navigator = { userAgent: 'Chrome/120' } as Navigator;
	});

	it('shouldHandle returns true for ReactNativeApplication methods', () => {
		const pageManager = createMockPageManager();
		const agent = createReactNativeAgent(pageManager);

		assert.strictEqual(agent.shouldHandle({ method: 'ReactNativeApplication.enable' }), true);
		assert.strictEqual(agent.shouldHandle({ method: 'ReactNativeApplication.disable' }), true);
		assert.strictEqual(agent.shouldHandle({ method: 'ReactNativeApplication.anything' }), true);
	});

	it('shouldHandle returns false for other methods', () => {
		const pageManager = createMockPageManager();
		const agent = createReactNativeAgent(pageManager);

		assert.strictEqual(agent.shouldHandle({ method: 'Runtime.evaluate' }), false);
		assert.strictEqual(agent.shouldHandle({ method: 'Debugger.pause' }), false);
		assert.strictEqual(agent.shouldHandle({ method: 'Network.enable' }), false);
	});

	it('shouldHandle returns false when method is missing', () => {
		const pageManager = createMockPageManager();
		const agent = createReactNativeAgent(pageManager);

		const result1 = agent.shouldHandle({});
		const result2 = agent.shouldHandle({ params: {} });

		assert.ok(!result1);
		assert.ok(!result2);
	});

	it('handleCommand enables agent and sends metadata', () => {
		const pages = [
			{
				id: 'page1',
				reactNativeMetadata: {
					appDisplayName: 'MyApp',
					reactNativeVersion: '0.73.0',
				},
			},
		];
		const pageManager = createMockPageManager(pages);
		const agent = createReactNativeAgent(pageManager);

		const responses: unknown[] = [];
		const sendResponse = (response: unknown) => responses.push(response);

		agent.handleCommand('page1', { id: 1, method: 'ReactNativeApplication.enable' }, sendResponse);

		assert.strictEqual(agent.isEnabled(), true);
		assert.strictEqual(responses.length, 2);

		assert.deepStrictEqual(responses[0], { id: 1, result: {} });

		assert.strictEqual((responses[1] as { method: string }).method, 'ReactNativeApplication.metadataUpdated');
		assert.strictEqual((responses[1] as { params: { appDisplayName: string } }).params.appDisplayName, 'MyApp');
		assert.strictEqual((responses[1] as { params: { reactNativeVersion: string } }).params.reactNativeVersion, '0.73.0');
		assert.strictEqual((responses[1] as { params: { platform: string } }).params.platform, 'web');
	});

	it('handleCommand disables agent', () => {
		const pageManager = createMockPageManager();
		const agent = createReactNativeAgent(pageManager);

		agent.handleCommand('page1', { id: 1, method: 'ReactNativeApplication.enable' }, () => { });

		const responses: unknown[] = [];
		const sendResponse = (response: unknown) => responses.push(response);

		agent.handleCommand('page1', { id: 2, method: 'ReactNativeApplication.disable' }, sendResponse);

		assert.strictEqual(agent.isEnabled(), false);
		assert.strictEqual(responses.length, 1);
		assert.deepStrictEqual(responses[0], { id: 2, result: {} });
	});

	it('handleCommand returns error for unknown ReactNativeApplication method', () => {
		const pageManager = createMockPageManager();
		const agent = createReactNativeAgent(pageManager);

		const responses: unknown[] = [];
		const sendResponse = (response: unknown) => responses.push(response);

		agent.handleCommand('page1', { id: 1, method: 'ReactNativeApplication.unknownMethod' }, sendResponse);

		assert.strictEqual(responses.length, 1);
		assert.strictEqual((responses[0] as { id: number }).id, 1);
		assert.ok((responses[0] as { error: unknown }).error);
		assert.strictEqual((responses[0] as { error: { code: number } }).error.code, -32601);
		assert.ok((responses[0] as { error: { message: string } }).error.message.includes('unknownMethod'));
	});

	it('getMetadata uses default values when page not found', () => {
		const pageManager = createMockPageManager([]);
		const agent = createReactNativeAgent(pageManager);

		const responses: unknown[] = [];
		const sendResponse = (response: unknown) => responses.push(response);

		agent.handleCommand('nonexistent', { id: 1, method: 'ReactNativeApplication.enable' }, sendResponse);

		const metadata = (responses[1] as { params: { appDisplayName: string; reactNativeVersion: string } }).params;
		assert.strictEqual(metadata.appDisplayName, 'Unknown App');
		assert.strictEqual(metadata.reactNativeVersion, '0.0.0');
	});

	it('getMetadata uses default values when reactNativeMetadata is missing', () => {
		const pages = [{ id: 'page1' }];
		const pageManager = createMockPageManager(pages);
		const agent = createReactNativeAgent(pageManager);

		const responses: unknown[] = [];
		const sendResponse = (response: unknown) => responses.push(response);

		agent.handleCommand('page1', { id: 1, method: 'ReactNativeApplication.enable' }, sendResponse);

		const metadata = (responses[1] as { params: { appDisplayName: string; reactNativeVersion: string } }).params;
		assert.strictEqual(metadata.appDisplayName, 'Unknown App');
		assert.strictEqual(metadata.reactNativeVersion, '0.0.0');
	});

	it('isEnabled returns false initially', () => {
		const pageManager = createMockPageManager();
		const agent = createReactNativeAgent(pageManager);

		assert.strictEqual(agent.isEnabled(), false);
	});

	it('metadata includes all required fields', () => {
		const pages = [
			{
				id: 'page1',
				reactNativeMetadata: {
					appDisplayName: 'TestApp',
					reactNativeVersion: '0.74.1',
				},
			},
		];
		const pageManager = createMockPageManager(pages);
		const agent = createReactNativeAgent(pageManager);

		const responses: unknown[] = [];
		const sendResponse = (response: unknown) => responses.push(response);

		agent.handleCommand('page1', { id: 1, method: 'ReactNativeApplication.enable' }, sendResponse);

		const metadata = (responses[1] as { params: Record<string, unknown> }).params;
		assert.strictEqual(metadata.appDisplayName, 'TestApp');
		assert.strictEqual(metadata.appIdentifier, '');
		assert.ok(metadata.deviceName);
		assert.strictEqual(metadata.integrationName, 'Rozenite');
		assert.strictEqual(metadata.platform, 'web');
		assert.strictEqual(metadata.reactNativeVersion, '0.74.1');
		assert.strictEqual(metadata.unstable_isProfilingBuild, false);
		assert.strictEqual(metadata.unstable_networkInspectionEnabled, true);
	});
});
