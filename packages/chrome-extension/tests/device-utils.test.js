import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { getDeviceName } from '../src/device-utils.js';

describe('getDeviceName', () => {
	let originalNavigator;

	beforeEach(() => {
		originalNavigator = globalThis.navigator;
	});

	afterEach(() => {
		if (originalNavigator) {
			globalThis.navigator = originalNavigator;
		} else {
			delete globalThis.navigator;
		}
	});

	it('returns "Unknown Browser" when navigator is undefined', () => {
		delete globalThis.navigator;
		assert.strictEqual(getDeviceName(), 'Unknown Browser');
	});

	it('returns "Unknown Browser" when userAgent is missing', () => {
		globalThis.navigator = {};
		assert.strictEqual(getDeviceName(), 'Unknown Browser');
	});

	it('detects Chrome with version', () => {
		globalThis.navigator = {
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
		};
		assert.strictEqual(getDeviceName(), 'Chrome 120');
	});

	it('detects Edge with version', () => {
		globalThis.navigator = {
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.133'
		};
		assert.strictEqual(getDeviceName(), 'Edge 120');
	});

	it('detects Firefox with version', () => {
		globalThis.navigator = {
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
		};
		assert.strictEqual(getDeviceName(), 'Firefox 121');
	});

	it('detects Safari with version', () => {
		globalThis.navigator = {
			userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
		};
		assert.strictEqual(getDeviceName(), 'Safari 17');
	});

	it('detects Opera with OPR string', () => {
		globalThis.navigator = {
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0'
		};
		assert.strictEqual(getDeviceName(), 'Opera 106');
	});

	it('returns browser name without version when version not found', () => {
		globalThis.navigator = {
			userAgent: 'Chrome'
		};
		assert.strictEqual(getDeviceName(), 'Chrome');
	});

	it('prioritizes Edge over Chrome when both present', () => {
		globalThis.navigator = {
			userAgent: 'Chrome/120.0.0.0 Edg/120.0.0.0'
		};
		const result = getDeviceName();
		assert.ok(result.startsWith('Edge'), 'Should detect Edge, not Chrome');
	});

	it('prioritizes specific browsers over generic Chrome', () => {
		globalThis.navigator = {
			userAgent: 'Mozilla/5.0 AppleWebKit/537.36 Chrome/120.0.0.0 OPR/106.0.0.0'
		};
		const result = getDeviceName();
		assert.ok(result.startsWith('Opera'), 'Should detect Opera over Chrome');
	});

	it('returns "Unknown Browser" for truly unknown user agents', () => {
		globalThis.navigator = {
			userAgent: 'SomeWeirdBrowser/1.0'
		};
		assert.strictEqual(getDeviceName(), 'Unknown Browser');
	});
});
