import { afterEach, describe, expect, it, vi } from 'vitest';
import { getJson, HttpError } from './http-client';

// The client keeps its results for the process lifetime, so each test uses its own URL.
describe('getJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shares one request between concurrent callers and reuses the result', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const url = 'https://example.test/shared';
    const results = await Promise.all([getJson(url), getJson(url), getJson(url)]);
    await getJson(url);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
  });

  it('evicts a failed request so the next call fetches again', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('missing', { status: 404 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const url = 'https://example.test/evicted';
    await expect(getJson(url)).rejects.toMatchObject({ name: 'HttpError', status: 404, url });
    await expect(getJson(url)).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps request headers out of error messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    );

    const error = await getJson('https://example.test/secret', {
      Authorization: 'Bearer top-secret',
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).message).not.toContain('top-secret');
  });
});
