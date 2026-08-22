import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const SETUP_SOURCE_PATH = path.join(PACKAGE_ROOT, 'src', 'metro', 'setup.js');
const SETUP_SOURCE = fs.readFileSync(SETUP_SOURCE_PATH, 'utf8');

type FakeModule = { verboseName?: string; isInitialized?: boolean };

type FakeGlobal = {
  performance?: { now: () => number };
  __r?: { getModules: () => Map<number, FakeModule> };
  __METRO_GLOBAL_PREFIX__?: string;
  __SYSTRACE?: unknown;
  __requireChains?: unknown[];
  __currentChain?: unknown;
  __requireChainListeners?: unknown[];
  __onRequireChainComplete?: (callback: (chain: unknown) => void) => () => void;
  __patchSystrace?: () => void;
  getRequireChainsList?: () => unknown[];
  getRequireChainData?: (index: number) => unknown;
  getBundleModules?: () => {
    modules: Array<{ id: number | string; name: string; evaluated: boolean }>;
    capturedAt: number;
  };
};

type Systrace = {
  beginEvent: (eventName: string, args?: unknown) => void;
  endEvent: (args?: unknown) => void;
};

/**
 * Runs the raw polyfill source in a sandbox, the same way Metro executes it
 * verbatim in a bundle: as a plain script (no imports) that reads/writes a
 * `global` object and reads a `__DEV__` flag from its surrounding scope.
 */
const runSetupInSandbox = (fakeGlobal: FakeGlobal, dev: boolean | undefined): void => {
  const sandbox = new Function('global', '__DEV__', SETUP_SOURCE);
  sandbox(fakeGlobal, dev);
};

const DEV_ONLY_GLOBALS = [
  'getRequireChainsList',
  'getRequireChainData',
  '__patchSystrace',
  '__onRequireChainComplete',
  'getBundleModules',
] as const;

describe('Metro polyfill __DEV__ guard', () => {
  it('defines none of the public globals when __DEV__ is false', () => {
    const fakeGlobal: FakeGlobal = {};

    runSetupInSandbox(fakeGlobal, false);

    for (const key of DEV_ONLY_GLOBALS) {
      expect(fakeGlobal[key]).toBeUndefined();
    }
  });

  it('defines none of the public globals when __DEV__ is undefined', () => {
    const fakeGlobal: FakeGlobal = {};

    runSetupInSandbox(fakeGlobal, undefined);

    for (const key of DEV_ONLY_GLOBALS) {
      expect(fakeGlobal[key]).toBeUndefined();
    }
  });

  it('defines all of the public globals when __DEV__ is true', () => {
    const fakeGlobal: FakeGlobal = { performance: { now: () => 0 } };

    runSetupInSandbox(fakeGlobal, true);

    for (const key of DEV_ONLY_GLOBALS) {
      expect(typeof fakeGlobal[key]).toBe('function');
    }
  });
});

describe('Metro polyfill require chain recorder', () => {
  const createSandbox = () => {
    // A fake, monotonic clock the test fully controls - `time` is advanced
    // manually between begin/end calls so durations are deterministic
    // instead of depending on real timing.
    let time = 0;
    const fakePerformance = { now: () => time };

    const modules = new Map<number, FakeModule>([
      [1, { verboseName: '/app/RootModule.js' }],
      [2, { verboseName: '/app/ChildModule.js' }],
    ]);

    const fakeGlobal: FakeGlobal = {
      performance: fakePerformance,
      __r: { getModules: () => modules },
    };

    runSetupInSandbox(fakeGlobal, true);

    // `__patchSystrace` creates a stub SYSTRACE since none exists yet.
    fakeGlobal.__patchSystrace!();
    const systrace = fakeGlobal.__SYSTRACE as Systrace;

    return {
      fakeGlobal,
      systrace,
      advanceTimeTo: (value: number) => {
        time = value;
      },
    };
  };

  it('records a nested require chain with duration, moduleCount, and startedAt', () => {
    const { fakeGlobal, systrace, advanceTimeTo } = createSandbox();

    const beforeStart = Date.now();

    advanceTimeTo(0);
    systrace.beginEvent('JS_require_1'); // root
    advanceTimeTo(5);
    systrace.beginEvent('JS_require_2'); // child
    advanceTimeTo(8);
    systrace.endEvent(); // ends module 2: 8 - 5 = 3ms
    advanceTimeTo(20);
    systrace.endEvent(); // ends module 1: 20 - 0 = 20ms

    const afterEnd = Date.now();

    const chains = fakeGlobal.getRequireChainsList!() as Array<{
      index: number;
      rootModuleId: number;
      rootModuleName: string;
      duration: number;
      moduleCount: number;
      startedAt: number;
    }>;

    expect(chains).toHaveLength(1);
    const [chain] = chains;

    expect(chain.index).toBe(0);
    expect(chain.rootModuleId).toBe(1);
    expect(chain.rootModuleName).toBe('/app/RootModule.js');
    expect(chain.duration).toBe(20);
    expect(chain.moduleCount).toBe(2);
    expect(chain.startedAt).toBeGreaterThanOrEqual(beforeStart);
    expect(chain.startedAt).toBeLessThanOrEqual(afterEnd);

    const data = fakeGlobal.getRequireChainData!(0) as {
      index: number;
      rootModuleId: number;
      rootModuleName: string;
      duration: number;
      moduleCount: number;
      startedAt: number;
      tree: {
        name: string;
        value: number;
        selfTime: number;
        tooltip: string;
        children: Array<{
          name: string;
          value: number;
          selfTime: number;
          tooltip: string;
          children: unknown[];
        }>;
      } | null;
    };

    expect(data.index).toBe(0);
    expect(data.rootModuleId).toBe(1);
    expect(data.rootModuleName).toBe('/app/RootModule.js');
    expect(data.duration).toBe(20);
    expect(data.moduleCount).toBe(2);
    expect(data.startedAt).toBe(chain.startedAt);

    expect(data.tree).not.toBeNull();
    const tree = data.tree!;
    expect(tree.name).toBe('RootModule.js');
    expect(tree.tooltip).toBe('/app/RootModule.js');
    expect(tree.value).toBe(20);
    expect(tree.selfTime).toBe(17); // 20 total - 3 spent in the child

    expect(tree.children).toHaveLength(1);
    const [child] = tree.children;
    expect(child.name).toBe('ChildModule.js');
    expect(child.tooltip).toBe('/app/ChildModule.js');
    expect(child.value).toBe(3);
    expect(child.selfTime).toBe(3); // no children of its own
    expect(child.children).toEqual([]);
  });

  it('returns null from getRequireChainData for an unknown chain index', () => {
    const { fakeGlobal } = createSandbox();

    expect(fakeGlobal.getRequireChainData!(0)).toBeNull();
  });

  it('notifies __onRequireChainComplete listeners with the same enriched metadata', () => {
    const { fakeGlobal, systrace, advanceTimeTo } = createSandbox();

    const received: unknown[] = [];
    const unsubscribe = fakeGlobal.__onRequireChainComplete!((chain) => {
      received.push(chain);
    });

    advanceTimeTo(0);
    systrace.beginEvent('JS_require_1');
    advanceTimeTo(10);
    systrace.endEvent();

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(fakeGlobal.getRequireChainsList!()[0]);

    unsubscribe();

    advanceTimeTo(20);
    systrace.beginEvent('JS_require_3');
    advanceTimeTo(25);
    systrace.endEvent();

    // Unsubscribed listener does not get notified about the second chain.
    expect(received).toHaveLength(1);
    expect(fakeGlobal.getRequireChainsList!()).toHaveLength(2);
  });

  it('swallows listener errors without breaking chain recording', () => {
    const { fakeGlobal, systrace, advanceTimeTo } = createSandbox();

    fakeGlobal.__onRequireChainComplete!(() => {
      throw new Error('boom');
    });

    advanceTimeTo(0);
    systrace.beginEvent('JS_require_1');
    advanceTimeTo(1);

    expect(() => systrace.endEvent()).not.toThrow();
    expect(fakeGlobal.getRequireChainsList!()).toHaveLength(1);
  });
});

describe('Metro polyfill getBundleModules', () => {
  it('reads the full module registry, mapping id/name/evaluated for each entry', () => {
    const modules = new Map<number, FakeModule>([
      [1, { verboseName: '/app/RootModule.js', isInitialized: true }],
      [2, { verboseName: '/app/ChildModule.js', isInitialized: false }],
      [3, { isInitialized: true }], // no verboseName - falls back to the id
    ]);

    const fakeGlobal: FakeGlobal = {
      performance: { now: () => 0 },
      __r: { getModules: () => modules },
    };

    runSetupInSandbox(fakeGlobal, true);

    const before = Date.now();
    const result = fakeGlobal.getBundleModules!();
    const after = Date.now();

    expect(result.modules).toHaveLength(3);
    expect(result.modules).toEqual(
      expect.arrayContaining([
        { id: 1, name: '/app/RootModule.js', evaluated: true },
        { id: 2, name: '/app/ChildModule.js', evaluated: false },
        { id: 3, name: '3', evaluated: true },
      ]),
    );
    expect(result.capturedAt).toBeGreaterThanOrEqual(before);
    expect(result.capturedAt).toBeLessThanOrEqual(after);
  });

  it('returns an empty module list without throwing when __r is unavailable', () => {
    const fakeGlobal: FakeGlobal = { performance: { now: () => 0 } };

    runSetupInSandbox(fakeGlobal, true);

    expect(() => fakeGlobal.getBundleModules!()).not.toThrow();
    expect(fakeGlobal.getBundleModules!()).toEqual({
      modules: [],
      capturedAt: expect.any(Number),
    });
  });

  it('is not defined when __DEV__ is false', () => {
    const fakeGlobal: FakeGlobal = {};

    runSetupInSandbox(fakeGlobal, false);

    expect(fakeGlobal.getBundleModules).toBeUndefined();
  });
});
