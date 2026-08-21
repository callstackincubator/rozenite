// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `rn-devtools-frontend.ts` re-exports modules that only exist inside the real
// DevTools frontend (`/rozenite/core/sdk/sdk.js`). The tracker only needs the
// target manager's `observeModels`, so this stub hands the test the observer
// that was registered and lets it play the frontend's part.
const observers: Array<{
  modelAdded: (model: FakeModel) => void;
  modelRemoved: (model: FakeModel) => void;
}> = [];

class ReactNativeApplicationModel {}

vi.mock('../rn-devtools-frontend.js', () => ({
  SDK: {
    ReactNativeApplicationModel: { ReactNativeApplicationModel },
    TargetManager: {
      TargetManager: {
        instance: () => ({
          observeModels: (_model: unknown, observer: (typeof observers)[number]) => {
            observers.push(observer);
          },
        }),
      },
    },
  },
}));

const { getFramework, trackFrameworkTitle, withFramework } = await import('../framework-title.js');

type MetadataListener = (event: { data: { platform?: string } }) => void;

class FakeModel {
  metadataCached: { platform?: string } | null = null;
  enabled = false;
  readonly listeners = new Set<MetadataListener>();

  ensureEnabled(): void {
    this.enabled = true;
  }

  addEventListener(_event: string, listener: MetadataListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_event: string, listener: MetadataListener): void {
    this.listeners.delete(listener);
  }

  emitMetadata(metadata: { platform?: string }): void {
    this.metadataCached = metadata;
    this.listeners.forEach((listener) => listener({ data: metadata }));
  }
}

// `document.title = ...` mutates the `<title>` element, and MutationObserver
// callbacks are delivered as a microtask — awaiting one lets the tracker's
// re-application run before the assertion.
const flush = () => Promise.resolve();

const attachModel = (): FakeModel => {
  const model = new FakeModel();
  observers.forEach((observer) => observer.modelAdded(model as never));
  return model;
};

beforeEach(() => {
  observers.length = 0;
  // A fresh `<title>` per test, not just a fresh string: `trackFrameworkTitle`
  // observes the element it finds and has no teardown (in the frontend it
  // lives as long as the page does), so a previous test's tracker would
  // otherwise keep re-labelling this test's title with its own framework —
  // two trackers disagreeing rewrite each other forever.
  document.head.innerHTML = '<title>React Native DevTools</title>';
});

describe('getFramework', () => {
  it('reads a browser page as Web — the platform the Chrome extension reports', () => {
    expect(getFramework({ platform: 'web' })).toBe('Web');
  });

  it('reads a device OS as React Native', () => {
    expect(getFramework({ platform: 'ios' })).toBe('React Native');
    expect(getFramework({ platform: 'android' })).toBe('React Native');
  });

  it('falls back to React Native for metadata without a platform', () => {
    expect(getFramework({})).toBe('React Native');
  });
});

describe('withFramework', () => {
  it('puts the framework in front of the title the frontend built', () => {
    expect(withFramework('MyApp (iPhone) - React Native DevTools', 'React Native')).toBe(
      'React Native · MyApp (iPhone) - React Native DevTools',
    );
  });

  it('is idempotent, so re-applying it never stacks a second label', () => {
    const once = withFramework('MyApp (Chrome) - React Native DevTools', 'Web');

    expect(withFramework(once, 'Web')).toBe(once);
  });

  it('replaces a previous label rather than prefixing it', () => {
    const asWeb = withFramework('MyApp - React Native DevTools', 'Web');

    expect(withFramework(asWeb, 'React Native')).toBe(
      'React Native · MyApp - React Native DevTools',
    );
  });
});

describe('trackFrameworkTitle', () => {
  it('labels the title once metadata arrives', async () => {
    trackFrameworkTitle();
    const model = attachModel();

    expect(document.title).toBe('React Native DevTools');

    model.emitMetadata({ platform: 'web' });

    expect(document.title).toBe('Web · React Native DevTools');
    expect(model.enabled).toBe(true);
  });

  it('uses metadata that arrived before it started observing', () => {
    trackFrameworkTitle();
    const model = new FakeModel();
    model.metadataCached = { platform: 'web' };
    observers.forEach((observer) => observer.modelAdded(model as never));

    expect(document.title).toBe('Web · React Native DevTools');
  });

  it('re-applies the label when the frontend rewrites the title', async () => {
    trackFrameworkTitle();
    attachModel().emitMetadata({ platform: 'ios' });

    // What the frontend does on every metadata/system-state change: it
    // rebuilds the title from its own parts, dropping anything else.
    document.title = 'MyApp (iPhone) [PROFILING] - React Native DevTools';
    await flush();

    expect(document.title).toBe(
      'React Native · MyApp (iPhone) [PROFILING] - React Native DevTools',
    );
  });

  it('settles instead of looping on its own write', async () => {
    trackFrameworkTitle();
    attachModel().emitMetadata({ platform: 'ios' });

    document.title = 'MyApp - React Native DevTools';
    await flush();
    await flush();
    await flush();

    expect(document.title).toBe('React Native · MyApp - React Native DevTools');
  });

  it('leaves the title alone until a framework is known', async () => {
    trackFrameworkTitle();
    attachModel();

    document.title = 'MyApp - React Native DevTools';
    await flush();

    expect(document.title).toBe('MyApp - React Native DevTools');
  });
});
