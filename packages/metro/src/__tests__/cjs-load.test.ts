import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Metro loads Rozenite through a plain `require()` (see
// apps/playground/metro.config.js), resolving each package's `require`
// export condition to its built CJS bundle (dist/index.cjs) -- never the
// TypeScript source. A dependency that's ESM-only (like p-limit was) can
// pass every other test here and still crash Metro at startup, because
// Vite/Rollup externalizes such dependencies into a literal top-level
// `require(...)` call in that bundle.
//
// This has to run in a real, separate `node` process rather than calling
// require()/createRequire() directly from this test: Vitest's own module
// runner intercepts module resolution for the whole worker (even for
// dynamic requires) and prefers each package's `development` export
// condition, which points at the TypeScript source -- silently bypassing
// the exact failure mode this test exists to catch.
// See docs/agents/metro-testing.md.
const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
const playgroundRoot = path.resolve(packageRoot, '../../apps/playground');

const runInNode = (script: string): string =>
  execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: packageRoot,
    encoding: 'utf8',
    timeout: 30_000,
  });

describe('CJS load (mirrors how Metro requires Rozenite)', () => {
  it('requires @rozenite/tools, @rozenite/middleware and @rozenite/metro without throwing', () => {
    expect(() =>
      runInNode(`
        import { createRequire } from 'node:module';
        const require = createRequire(import.meta.url);
        require('@rozenite/tools');
        require('@rozenite/middleware');
        const mod = require('@rozenite/metro');
        if (typeof mod.withRozenite !== 'function') {
          throw new Error('withRozenite was not exported as a function');
        }
      `),
    ).not.toThrow();
  });

  it('runs withRozenite end-to-end (incl. plugin auto-discovery) under a real require()', () => {
    const output = runInNode(`
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
      const { withRozenite } = require('@rozenite/metro');
      const config = withRozenite({ projectRoot: ${JSON.stringify(playgroundRoot)} }, { enabled: true });
      const resolved = await config();
      console.log('__RESULT__' + JSON.stringify({ projectRoot: resolved.projectRoot }));
    `);

    const resultLine = output.split('\n').find((line) => line.startsWith('__RESULT__'));
    expect(JSON.parse(resultLine?.slice('__RESULT__'.length) ?? '')).toEqual({
      projectRoot: playgroundRoot,
    });
  });
});
