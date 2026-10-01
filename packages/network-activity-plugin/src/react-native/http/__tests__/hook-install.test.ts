// @vitest-environment jsdom
import Module from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Recorder, RecorderHandle } from '../recorder';

// The install paths read Expo's private fetch module through a real Node
// `require`, so the seam is `Module._load` rather than Vitest's mocks.
type Loader = (request: string, ...rest: unknown[]) => unknown;
const moduleWithLoad = Module as unknown as { _load: Loader };
const originalLoad = moduleWithLoad._load;
let expoModule: { fetch: typeof fetch } | null = null;

const createRecorder = () => {
  const begins: string[] = [];
  const recorder: Recorder = {
    begin: (meta) => {
      begins.push(`${meta.source}:${meta.type}`);
      const handle: RecorderHandle = {
        requestId: `id-${begins.length}`,
        markHeadersReceived: vi.fn(),
        headers: vi.fn(),
        progress: vi.fn(),
        end: vi.fn(),
        fail: vi.fn(),
      };
      return handle;
    },
    getResponseBody: vi.fn(async () => null),
    on: vi.fn(() => () => undefined),
    clear: vi.fn(),
  };
  return { recorder, begins };
};

const loadFetchHook = async () => {
  vi.resetModules();
  return import('../fetch-hook');
};

beforeEach(() => {
  moduleWithLoad._load = function (request: string, ...rest: unknown[]) {
    if (request === 'expo/src/winter/fetch/fetch') {
      if (!expoModule) throw new Error(`Cannot find module '${request}'`);
      return expoModule;
    }
    return originalLoad.call(this, request, ...rest);
  };
});

afterEach(() => {
  moduleWithLoad._load = originalLoad;
  expoModule = null;
  delete (globalThis as { fetch?: unknown }).fetch;
});

describe('enableFetchHook / disableFetchHook', () => {
  it('wraps an already-resolved Expo global once and restores it', async () => {
    const expoFetch = vi.fn(async () => new Response('{}')) as unknown as typeof fetch;
    expoModule = { fetch: expoFetch };
    globalThis.fetch = expoFetch;
    const { enableFetchHook, disableFetchHook } = await loadFetchHook();
    const { recorder, begins } = createRecorder();

    enableFetchHook(recorder);
    await globalThis.fetch('https://example.com/');
    await expoModule.fetch('https://example.com/');
    expect(begins).toEqual(['expo:Fetch', 'expo:Fetch']);
    expect(globalThis.fetch.name).toBe(expoFetch.name);

    disableFetchHook();
    expect(globalThis.fetch).toBe(expoFetch);
    expect(expoModule.fetch).toBe(expoFetch);
  });

  it('restores a global that lazily resolved to the wrapper, so a re-enable records it', async () => {
    const expoFetch = vi.fn(async () => new Response('{}')) as unknown as typeof fetch;
    expoModule = { fetch: expoFetch };
    const { enableFetchHook, disableFetchHook } = await loadFetchHook();
    const { recorder, begins } = createRecorder();

    enableFetchHook(recorder);
    // Expo SDK 56+ installs the global alias as a live getter onto the
    // private export, which by now holds our wrapper.
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      get: () => expoModule!.fetch,
      set: (value) => {
        expoModule!.fetch = value;
      },
    });
    await globalThis.fetch('https://example.com/');
    expect(begins).toEqual(['expo:Fetch']);

    disableFetchHook();
    expect(globalThis.fetch).toBe(expoFetch);

    enableFetchHook(recorder);
    await globalThis.fetch('https://example.com/');
    expect(begins).toEqual(['expo:Fetch', 'expo:Fetch']);
    disableFetchHook();
  });

  it("never wraps a global that is not Expo's implementation", async () => {
    const expoFetch = vi.fn(async () => new Response('{}')) as unknown as typeof fetch;
    const appWrapper = vi.fn(async () => new Response('{}')) as unknown as typeof fetch;
    expoModule = { fetch: expoFetch };
    globalThis.fetch = appWrapper;
    const { enableFetchHook, disableFetchHook } = await loadFetchHook();
    const { recorder, begins } = createRecorder();

    enableFetchHook(recorder);
    expect(globalThis.fetch).toBe(appWrapper);
    await globalThis.fetch('https://example.com/');
    expect(begins).toEqual([]);
    disableFetchHook();
  });

  it('stays disabled without Expo', async () => {
    const { enableFetchHook, isFetchHookEnabled } = await loadFetchHook();
    const { recorder } = createRecorder();
    enableFetchHook(recorder);
    expect(isFetchHookEnabled()).toBe(true);
    expect(globalThis.fetch).toBeUndefined();
  });
});
