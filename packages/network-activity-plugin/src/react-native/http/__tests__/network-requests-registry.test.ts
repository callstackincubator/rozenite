import { describe, expect, it } from 'vitest';
import { getNetworkRequestsRegistry } from '../network-requests-registry';

describe('getNetworkRequestsRegistry', () => {
  it('stores response bodies for fetch-owned requests without an XHR entry', () => {
    const registry = getNetworkRequestsRegistry();

    registry.setResponseBody('fetch-1', '{"ok":true}');

    expect(registry.getEntry('fetch-1')).toBeNull();
    expect(registry.getResponseBody('fetch-1')).toBe('{"ok":true}');
  });

  it('keeps the XHR request entry and response body side by side', () => {
    const registry = getNetworkRequestsRegistry();
    const xhr = {
      responseType: '',
    } as unknown as XMLHttpRequest;

    registry.addEntry('xhr-1', xhr);
    registry.setResponseBody('xhr-1', 'hello');

    expect(registry.getEntry('xhr-1')).toBe(xhr);
    expect(registry.getResponseBody('xhr-1')).toBe('hello');
  });
});
