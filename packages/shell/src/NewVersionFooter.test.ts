import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAvailableRuntimeVersion } from './new-version';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('getAvailableRuntimeVersion', () => {
  it('returns the npm version when it differs from the installed runtime', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.14.0' }),
    });

    await expect(getAvailableRuntimeVersion('1.13.0')).resolves.toBe('1.14.0');
  });

  it('returns null when the installed runtime is current', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.13.0' }),
    });

    await expect(getAvailableRuntimeVersion('1.13.0')).resolves.toBeNull();
  });

  it('rejects failed npm requests', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    await expect(getAvailableRuntimeVersion('1.13.0')).rejects.toThrow(
      'Failed to fetch the latest Rozenite version: 503',
    );
  });
});
