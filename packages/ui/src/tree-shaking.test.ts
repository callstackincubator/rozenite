import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, type Rollup } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * A plugin panel imports the few components it needs from `@rozenite/ui`, and its bundler is
 * expected to leave the rest behind. That only works while no module-scope statement is
 * something the bundler has to assume has side effects: an unannotated
 * `Object.assign(Root, { ... })`, `cva(...)` or `createContext(...)` keeps its component and
 * every `@base-ui/react/*` module behind it in every bundle, whatever the consumer imports.
 *
 * This bundles tiny consumers against the built `dist` the way a plugin would, as a package
 * under `node_modules` with Vite's production build, and checks what ended up inside.
 */

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const distEntry = path.join(packageRoot, 'dist', 'index.js');

let workDir: string;

beforeAll(() => {
  if (!existsSync(distEntry)) {
    throw new Error('dist/index.js is missing. Run `pnpm --filter @rozenite/ui build` first.');
  }

  workDir = mkdtempSync(path.join(tmpdir(), 'rozenite-ui-tree-shaking-'));
  mkdirSync(path.join(workDir, 'node_modules', '@rozenite'), { recursive: true });
  // Resolve through a package link, so `package.json#sideEffects` applies as it does for a
  // real install. An alias straight to `dist/index.js` would skip it.
  symlinkSync(
    packageRoot,
    path.join(workDir, 'node_modules', '@rozenite', 'ui'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
});

afterAll(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

type Bundled = {
  /** Every `data-slot` value that survived, one per component part. */
  slots: string[];
  /** Minified, gzipped size in kB. */
  gzipKb: number;
};

async function bundleConsumer(name: string, importNames: string[]): Promise<Bundled> {
  const entry = path.join(workDir, `${name}.js`);
  writeFileSync(
    entry,
    `import { ${importNames.join(', ')} } from '@rozenite/ui';\nexport const used = [${importNames.join(', ')}];\n`,
  );

  const result = await build({
    root: workDir,
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: 'esbuild',
      reportCompressedSize: false,
      rollupOptions: {
        input: entry,
        // Keep the entry's exports, or there is nothing to keep alive.
        preserveEntrySignatures: 'exports-only',
        external: [/^react(-dom)?(\/|$)/],
        output: { format: 'es' },
      },
    },
  });

  const output = (Array.isArray(result) ? result[0] : result) as Rollup.RollupOutput;
  const code = output.output
    .filter((chunk): chunk is Rollup.OutputChunk => chunk.type === 'chunk')
    .map((chunk) => chunk.code)
    .join('\n');
  const slots = [...code.matchAll(/data-slot["']?\s*[:=]\s*["']([a-z0-9-]+)["']/g)].map(
    (match) => match[1],
  );

  return {
    slots: [...new Set(slots)].sort(),
    gzipKb: gzipSync(code).length / 1024,
  };
}

// A bundle takes about a second on an idle machine, but Turborepo runs this beside the other
// packages' suites, and Vitest's default of 5 seconds is too close for that.
const BUNDLE_TIMEOUT = 60_000;

describe('@rozenite/ui tree shaking', () => {
  it(
    'bundles only the Button for a consumer that imports only the Button',
    async () => {
      const { slots, gzipKb } = await bundleConsumer('button-only', ['Button']);

      // Any other slot is a component, or a part of one, that a module-scope statement kept alive.
      // Before the module-scope calls were annotated this was 96 of the library's 124 slots.
      expect(slots).toEqual(['button']);

      // 11 kB at the time of writing, nearly all of it tailwind-merge. It was 110 kB when every
      // component was retained, so this fails for a regression and not for a dependency bump.
      expect(gzipKb).toBeLessThan(20);
    },
    BUNDLE_TIMEOUT,
  );

  it(
    'drops every component for a consumer that imports only tokens and hooks',
    async () => {
      // These live in modules that also define compound components or class-variance configs.
      const { slots, gzipKb } = await bundleConsumer('tokens-only', [
        'sizeHeight',
        'useToast',
        'useConfirmDialog',
        'usePluginTheme',
      ]);

      expect(slots).toEqual([]);
      // A module-scope `cn(...)` call retains tailwind-merge, ~8 kB gzipped, here.
      expect(gzipKb).toBeLessThan(2);
    },
    BUNDLE_TIMEOUT,
  );
});
