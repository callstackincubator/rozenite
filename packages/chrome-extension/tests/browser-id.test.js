import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { createBrowserId } from '../src/browser-id.js';
import { createChromeStub } from './stubs.js';

const noopLogger = { info: () => { }, warn: () => { }, error: () => { } };

describe('BrowserId', () => {
	let chromeStub;
	let randomUUIDMock;

	beforeEach(() => {
		chromeStub = createChromeStub();
		globalThis.chrome = chromeStub;
		globalThis.logger = noopLogger;
		// Mock the global crypto.randomUUID (Web Crypto API, used in browser/service worker)
		randomUUIDMock = mock.method(globalThis.crypto, 'randomUUID');
	});

	afterEach(() => {
		delete globalThis.chrome;
		delete globalThis.logger;
		randomUUIDMock.mock.restore();
	});

	it('generates a new UUID when storage is empty', async () => {
		randomUUIDMock.mock.mockImplementation(() => 'generated-uuid-1234');

		const browserId = createBrowserId();
		const id = await browserId.getId();

		assert.strictEqual(id, 'generated-uuid-1234');
	});

	it('stores the generated UUID in chrome.storage.local', async () => {
		randomUUIDMock.mock.mockImplementation(() => 'stored-uuid-5678');

		const browserId = createBrowserId();
		await browserId.getId();

		// Verify it was persisted
		const stored = await chrome.storage.local.get('browserId');
		assert.strictEqual(stored.browserId, 'stored-uuid-5678');
	});

	it('returns existing UUID from storage', async () => {
		chromeStub.configure.setStorageData({ browserId: 'existing-uuid-9999' });

		const browserId = createBrowserId();
		const id = await browserId.getId();

		assert.strictEqual(id, 'existing-uuid-9999');
	});

	it('caches the UUID after first call', async () => {
		chromeStub.configure.setStorageData({ browserId: 'cached-uuid-1111' });

		const browserId = createBrowserId();
		const id1 = await browserId.getId();
		const id2 = await browserId.getId();

		assert.strictEqual(id1, 'cached-uuid-1111');
		assert.strictEqual(id2, 'cached-uuid-1111');
		assert.strictEqual(id1, id2);
	});

	it('does not overwrite existing UUID on subsequent calls', async () => {
		chromeStub.configure.setStorageData({ browserId: 'original-uuid' });
		randomUUIDMock.mock.mockImplementation(() => 'should-not-be-used');

		const browserId = createBrowserId();
		const id = await browserId.getId();

		assert.strictEqual(id, 'original-uuid');
		assert.strictEqual(randomUUIDMock.mock.callCount(), 0);
	});
});
