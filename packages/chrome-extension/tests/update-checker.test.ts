import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import {
	isNewerVersion,
	checkForUpdates,
	isDismissed,
	STORAGE_KEY_DISMISSED,
} from '../src/update-checker.js';
import { createChromeStub } from './stubs.js';

describe('isNewerVersion', () => {
	it('returns true when new version is greater (patch)', () => {
		assert.strictEqual(isNewerVersion('1.0.0', '1.0.1'), true);
	});

	it('returns true when new version is greater (minor)', () => {
		assert.strictEqual(isNewerVersion('1.0.0', '1.1.0'), true);
	});

	it('returns true when new version is greater (major)', () => {
		assert.strictEqual(isNewerVersion('1.0.0', '2.0.0'), true);
	});

	it('returns false when new version is less', () => {
		assert.strictEqual(isNewerVersion('1.0.1', '1.0.0'), false);
		assert.strictEqual(isNewerVersion('2.0.0', '1.0.0'), false);
	});

	it('returns false when versions are equal', () => {
		assert.strictEqual(isNewerVersion('1.0.0', '1.0.0'), false);
	});

	it('handles 2-part vs 3-part versions', () => {
		assert.strictEqual(isNewerVersion('1.0', '1.0.0'), false);
		assert.strictEqual(isNewerVersion('1.0', '1.0.1'), true);
	});
});

describe('checkForUpdates', () => {
	let chromeStub: ReturnType<typeof createChromeStub>;
	let fetchMock: ReturnType<typeof mock.fn>;
	let fetchMockTracker: ReturnType<typeof mock.method>;

	beforeEach(() => {
		chromeStub = createChromeStub();
		globalThis.chrome = {
			...chromeStub,
			runtime: {
				getManifest: () => ({ version: '1.0.0' }),
			},
		} as unknown as typeof chrome;

		fetchMock = mock.fn();
		fetchMockTracker = mock.method(globalThis, 'fetch', fetchMock);
	});

	afterEach(() => {
		delete (globalThis as { chrome?: unknown }).chrome;
		fetchMockTracker.mock.restore();
	});

	it('returns hasUpdate: true when remote version is newer', async () => {
		fetchMock.mock.mockImplementationOnce(() =>
			Promise.resolve({
				json: () => Promise.resolve({ version: '1.1.0' }),
			} as Response)
		);

		const result = await checkForUpdates();

		assert.strictEqual(result.hasUpdate, true);
		assert.strictEqual(result.latestVersion, '1.1.0');
		assert.ok(result.releasesUrl?.includes('github.com'));
	});

	it('returns hasUpdate: false when versions match', async () => {
		fetchMock.mock.mockImplementationOnce(() =>
			Promise.resolve({
				json: () => Promise.resolve({ version: '1.0.0' }),
			} as Response)
		);

		const result = await checkForUpdates();

		assert.strictEqual(result.hasUpdate, false);
		assert.strictEqual(result.latestVersion, undefined);
	});

	it('returns hasUpdate: false when dismissed within 24h (skips fetch)', async () => {
		const futureTime = Date.now() + 12 * 60 * 60 * 1000; // 12 hours from now
		chromeStub.configure.setStorageData({
			[STORAGE_KEY_DISMISSED]: futureTime,
		});

		const result = await checkForUpdates();

		assert.strictEqual(result.hasUpdate, false);
		assert.strictEqual(fetchMock.mock.callCount(), 0);
	});
});

describe('isDismissed', () => {
	let chromeStub: ReturnType<typeof createChromeStub>;

	beforeEach(() => {
		chromeStub = createChromeStub();
		globalThis.chrome = chromeStub as unknown as typeof chrome;
	});

	afterEach(() => {
		delete (globalThis as { chrome?: unknown }).chrome;
	});

	it('returns true when dismissedUntil is in the future', async () => {
		const futureTime = Date.now() + 60 * 60 * 1000; // 1 hour from now
		chromeStub.configure.setStorageData({
			[STORAGE_KEY_DISMISSED]: futureTime,
		});

		const result = await isDismissed();

		assert.strictEqual(result, true);
	});

	it('returns false when dismissedUntil is in the past', async () => {
		const pastTime = Date.now() - 60 * 60 * 1000; // 1 hour ago
		chromeStub.configure.setStorageData({
			[STORAGE_KEY_DISMISSED]: pastTime,
		});

		const result = await isDismissed();

		assert.strictEqual(result, false);
	});

	it('returns false when storage is empty', async () => {
		const result = await isDismissed();

		assert.strictEqual(result, false);
	});
});
