import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getInstalledPlugins } from '../auto-discovery.js';
import type { RozeniteConfig } from '../config.js';

// Benchmark harness for the plugin auto-discovery step. Excluded from the
// regular test suite (see the `**/*.bench.test.ts` entry in vite.config.ts)
// so it doesn't add ~1s of latency to every `pnpm test` run. To run it,
// temporarily drop that entry from vite.config.ts's `test.exclude`, then:
//   pnpm vitest run src/__tests__/auto-discovery.bench.test.ts

const TOTAL_DEPENDENCIES = 150;
const PLUGIN_RATE = 0.15; // fraction of deps that are valid rozenite plugins
const UNRESOLVABLE_RATE = 0.05; // fraction of deps that don't exist in node_modules
const ITERATIONS = 7;
const SIMULATED_LATENCY_MS = 3; // per fs op, emulating a slow/network-backed filesystem

let projectRoot: string;

const buildFixture = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rozenite-bench-'));
  const dependencies: Record<string, string> = {};

  for (let i = 0; i < TOTAL_DEPENDENCIES; i++) {
    const name = i % 4 === 0 ? `@bench-scope/pkg-${i}` : `bench-pkg-${i}`;
    dependencies[name] = '1.0.0';

    const isUnresolvable = i / TOTAL_DEPENDENCIES < UNRESOLVABLE_RATE;
    if (isUnresolvable) continue;

    const pkgRoot = path.join(root, 'node_modules', ...name.split('/'));
    fs.mkdirSync(pkgRoot, { recursive: true });
    fs.writeFileSync(
      path.join(pkgRoot, 'package.json'),
      JSON.stringify({ name, version: '1.0.0', main: './index.js' }),
    );
    fs.writeFileSync(path.join(pkgRoot, 'index.js'), 'module.exports = {};');

    const isPlugin = i / TOTAL_DEPENDENCIES < PLUGIN_RATE;
    if (isPlugin) {
      fs.mkdirSync(path.join(pkgRoot, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(pkgRoot, 'dist', 'rozenite.json'), JSON.stringify({ name }));
    }
  }

  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'bench-app', version: '1.0.0', dependencies }),
  );

  return root;
};

// Simulates a slow/network-backed filesystem by adding a fixed delay to
// every fs/promises op the discovery code actually performs (readFile,
// access, realpath), without touching unrelated I/O.
const withSimulatedLatency = async <T>(fn: () => Promise<T>): Promise<T> => {
  const delay = () => new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));

  const origReadFile = fsp.readFile;
  const origAccess = fsp.access;
  const origRealpath = fsp.realpath;

  // @ts-expect-error -- benchmark instrumentation
  fsp.readFile = async (...args: Parameters<typeof fsp.readFile>) => {
    await delay();
    return origReadFile(...args);
  };
  fsp.access = async (...args: Parameters<typeof fsp.access>) => {
    await delay();
    return origAccess(...args);
  };
  // @ts-expect-error -- benchmark instrumentation
  fsp.realpath = async (...args: Parameters<typeof fsp.realpath>) => {
    await delay();
    return origRealpath(...args);
  };

  try {
    return await fn();
  } finally {
    fsp.readFile = origReadFile;
    fsp.access = origAccess;
    fsp.realpath = origRealpath;
  }
};

const timeRuns = async (config: RozeniteConfig, iterations: number): Promise<number[]> => {
  const timings: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await getInstalledPlugins(config);
    timings.push(performance.now() - start);
  }
  return timings;
};

const summarize = (label: string, timings: number[]): void => {
  const sorted = [...timings].sort((a, b) => a - b);
  const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log(
    `[bench] ${label}: min=${sorted[0].toFixed(1)}ms median=${median.toFixed(1)}ms mean=${mean.toFixed(1)}ms max=${sorted.at(-1)!.toFixed(1)}ms (n=${timings.length}, deps=${TOTAL_DEPENDENCIES})`,
  );
};

beforeAll(() => {
  projectRoot = buildFixture();
});

afterAll(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

describe('getInstalledPlugins benchmark', () => {
  it('measures discovery time on local disk', async () => {
    const config: RozeniteConfig = { projectRoot };
    const timings = await timeRuns(config, ITERATIONS);
    summarize('local-disk', timings);
    expect(timings.length).toBe(ITERATIONS);
  });

  it('measures discovery time on a simulated slow/network filesystem', async () => {
    const config: RozeniteConfig = { projectRoot };
    const timings = await withSimulatedLatency(() => timeRuns(config, ITERATIONS));
    summarize('simulated-slow-fs', timings);
    expect(timings.length).toBe(ITERATIONS);
  }, 30_000);
});
