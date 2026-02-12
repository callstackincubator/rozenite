import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { getDeviceName } from '../src/device-utils.js';

describe('getDeviceName', () => {
	let originalNavigator: typeof navigator | undefined;

	beforeEach(() => {
		originalNavigator = globalThis.navigator;
	});

	afterEach(() => {
		if (originalNavigator) {
			globalThis.navigator = originalNavigator;
		} else {
			delete (globalThis as { navigator?: unknown }).navigator;
		}
	});

	it('returns "Unknown Browser" when navigator is undefined', () => {
		delete (globalThis as { navigator?: unknown }).navigator;
		assert.strictEqual(getDeviceName(), 'Unknown Browser');
	});

	it('returns "Unknown Browser" when userAgent is missing', () => {
		globalThis.navigator = {} as Navigator;
		assert.strictEqual(getDeviceName(), 'Unknown Browser');
	});

	it('detects Chrome with version', () => {
		globalThis.navigator = {
			userAgent:
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		} as Navigator;
		assert.strictEqual(getDeviceName(), 'Chrome 120');
	});

	it('detects Edge with version', () => {
		globalThis.navigator = {
			userAgent:
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.133',
		} as Navigator;
		assert.strictEqual(getDeviceName(), 'Edge 120');
	});

	it('detects Firefox with version', () => {
		globalThis.navigator = {
			userAgent:
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
		} as Navigator;
		assert.strictEqual(getDeviceName(), 'Firefox 121');
	});

	it('detects Safari with version', () => {
		globalThis.navigator = {
			userAgent:
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
		} as Navigator;
		assert.strictEqual(getDeviceName(), 'Safari 17');
	});

	it('detects Opera with OPR string', () => {
		globalThis.navigator = {
			userAgent:
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
		} as Navigator;
		assert.strictEqual(getDeviceName(), 'Opera 106');
	});

	it('returns browser name without version when version not found', () => {
		globalThis.navigator = {
			userAgent: 'Chrome',
		} as Navigator;
		assert.strictEqual(getDeviceName(), 'Chrome');
	});

	it('prioritizes Edge over Chrome when both present', () => {
		globalThis.navigator = {
			userAgent: 'Chrome/120.0.0.0 Edg/120.0.0.0',
		} as Navigator;
		const result = getDeviceName();
		assert.ok(result.startsWith('Edge'), 'Should detect Edge, not Chrome');
	});

	it('prioritizes specific browsers over generic Chrome', () => {
		globalThis.navigator = {
			userAgent: 'Mozilla/5.0 AppleWebKit/537.36 Chrome/120.0.0.0 OPR/106.0.0.0',
		} as Navigator;
		const result = getDeviceName();
		assert.ok(result.startsWith('Opera'), 'Should detect Opera over Chrome');
	});

	it('returns "Unknown Browser" for truly unknown user agents', () => {
		globalThis.navigator = {
			userAgent: 'SomeWeirdBrowser/1.0',
		} as Navigator;
		assert.strictEqual(getDeviceName(), 'Unknown Browser');
	});
});
