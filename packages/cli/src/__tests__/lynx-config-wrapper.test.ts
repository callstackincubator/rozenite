import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import { wrapLynxConfigFile } from '../utils/config-wrapper.js';

/**
 * Real syntax validation via the TypeScript parser, rather than a
 * brace-counting heuristic -- `transpileModule` with `reportDiagnostics`
 * catches things a balanced-braces check can't, like two array elements
 * with no comma between them.
 */
const assertValidSyntax = (code: string): void => {
  const result = ts.transpileModule(code, {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.ESNext },
  });

  if (result.diagnostics && result.diagnostics.length > 0) {
    const messages = result.diagnostics
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
      .join('; ');
    expect.fail(`Expected valid syntax, got: ${messages}\n\n${code}`);
  }
};

const FIXTURES = {
  basic: `import { defineConfig } from '@lynx-js/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginReactLynx(),
  ],
});
`,
  // Matches the trailing-comma-free shape a `trailingComma: "none"` Prettier
  // config (or a hand-written array) produces.
  noTrailingComma: `import { defineConfig } from '@lynx-js/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginReactLynx()
  ]
});
`,
  playgroundLike: `import { defineConfig } from '@lynx-js/rspeedy';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';

export default defineConfig({
  plugins: [
    pluginQRCode({
      schema(url) {
        return \`\${url}?fullscreen=true\`;
      },
    }),
    pluginReactLynx(),
    pluginTypeCheck(),
  ],
});
`,
  // A plugin call whose argument is a template literal containing a raw
  // `]` -- naive bracket counting over unparsed source closes the plugins
  // array early here and corrupts the template literal.
  bracketInsideTemplateLiteral: `import { defineConfig } from '@lynx-js/rspeedy';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginQRCode({
      schema(url) {
        return \`\${url}?x=]\`;
      },
    }),
    pluginReactLynx(),
  ],
});
`,
  // A "plugins" key that appears first in the file but belongs to a nested
  // object, not the top-level rspeedy plugins array.
  nestedPluginsKey: `import { defineConfig } from '@lynx-js/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  tools: {
    rspack: {
      plugins: [],
    },
  },
  plugins: [
    pluginReactLynx(),
  ],
});
`,
  // A commented-out "plugins" array that textually matches before the real
  // one.
  pluginsKeyInComment: `import { defineConfig } from '@lynx-js/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

// plugins: [ legacy note ]
export default defineConfig({
  plugins: [
    pluginReactLynx(),
  ],
});
`,
  // The import is present but the call is commented out -- not actually
  // configured.
  commentedOutUsage: `import { defineConfig } from '@lynx-js/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { rozeniteLynxPlugin } from '@rozenite/lynx/rspeedy';

export default defineConfig({
  plugins: [
    pluginReactLynx(),
    // rozeniteLynxPlugin(),
  ],
});
`,
  emptyPluginsArray: `import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  plugins: [],
});
`,
  inlinePluginsArray: `import { defineConfig } from '@lynx-js/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({ plugins: [pluginReactLynx()] });
`,
  commonjs: `const { defineConfig } = require('@lynx-js/rspeedy');
const { pluginReactLynx } = require('@lynx-js/react-rsbuild-plugin');

module.exports = defineConfig({
  plugins: [
    pluginReactLynx(),
  ],
});
`,
  alreadyWrapped: `import { defineConfig } from '@lynx-js/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { rozeniteLynxPlugin } from '@rozenite/lynx/rspeedy';

export default defineConfig({
  plugins: [
    pluginReactLynx(),
    rozeniteLynxPlugin(),
  ],
});
`,
  noPluginsArray: `import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  source: {},
});
`,
};

describe('wrapLynxConfigFile', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lynx-config-wrapper-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createConfigFile = async (content: string, filename = 'lynx.config.ts') => {
    const configPath = path.join(tempDir, filename);
    await fs.writeFile(configPath, content, 'utf8');
    return configPath;
  };

  it('adds the import and appends the plugin call to a multiline plugins array', async () => {
    const configPath = await createConfigFile(FIXTURES.basic);

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    expect(wrapped).toContain("import { rozeniteLynxPlugin } from '@rozenite/lynx/rspeedy';");
    expect(wrapped).toContain('    rozeniteLynxPlugin(),');
    // The plugin call comes after the last existing plugin, still inside the array.
    expect(wrapped.indexOf('pluginReactLynx()')).toBeLessThan(
      wrapped.indexOf('rozeniteLynxPlugin()'),
    );
    expect(wrapped.indexOf('rozeniteLynxPlugin()')).toBeLessThan(wrapped.lastIndexOf(']'));
    assertValidSyntax(wrapped);
  });

  it('inserts a separating comma when the last element has none (trailingComma: "none" style)', async () => {
    const configPath = await createConfigFile(FIXTURES.noTrailingComma);

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    expect(wrapped).toContain('pluginReactLynx(),');
    expect(wrapped).toContain('rozeniteLynxPlugin(),');
    assertValidSyntax(wrapped);
  });

  it('appends after multiple existing plugins, including ones with object arguments', async () => {
    const configPath = await createConfigFile(FIXTURES.playgroundLike);

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    expect(wrapped).toContain("import { rozeniteLynxPlugin } from '@rozenite/lynx/rspeedy';");
    expect(wrapped).toContain('rozeniteLynxPlugin(),');
    // pluginQRCode's nested `schema(url) { ... }` braces must not confuse the
    // plugins-array bracket matching into stopping early.
    expect(wrapped.indexOf('pluginTypeCheck()')).toBeLessThan(
      wrapped.indexOf('rozeniteLynxPlugin()'),
    );
    assertValidSyntax(wrapped);
  });

  it('does not stop the array scan on a `]` inside a template literal', async () => {
    const configPath = await createConfigFile(FIXTURES.bracketInsideTemplateLiteral);

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    // The template literal must survive untouched -- the plugin call must
    // land after it, inside the real plugins array, not spliced into it.
    expect(wrapped).toContain('return `${url}?x=]`;');
    expect(wrapped.indexOf('return `${url}?x=]`;')).toBeLessThan(
      wrapped.indexOf('rozeniteLynxPlugin()'),
    );
    expect(wrapped.indexOf('pluginReactLynx()')).toBeLessThan(
      wrapped.indexOf('rozeniteLynxPlugin()'),
    );
    assertValidSyntax(wrapped);
  });

  it('targets the top-level plugins array, not one nested in another property', async () => {
    const configPath = await createConfigFile(FIXTURES.nestedPluginsKey);

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    // The nested `tools.rspack.plugins` array must stay untouched.
    expect(wrapped).toContain('plugins: [],');
    // The plugin call must land in the top-level array, after pluginReactLynx().
    expect(wrapped.indexOf('pluginReactLynx()')).toBeLessThan(
      wrapped.indexOf('rozeniteLynxPlugin()'),
    );
    // And not inside `tools`.
    expect(wrapped.indexOf('rozeniteLynxPlugin()')).toBeGreaterThan(wrapped.indexOf('tools:'));
    const toolsBlockEnd = wrapped.indexOf('},\n  plugins:');
    expect(toolsBlockEnd).toBeGreaterThan(-1);
    expect(wrapped.indexOf('rozeniteLynxPlugin()')).toBeGreaterThan(toolsBlockEnd);
    assertValidSyntax(wrapped);
  });

  it('does not match a "plugins" key that only appears inside a comment', async () => {
    const configPath = await createConfigFile(FIXTURES.pluginsKeyInComment);

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    // The comment must be untouched -- the plugin call belongs in the real array.
    expect(wrapped).toContain('// plugins: [ legacy note ]');
    expect(wrapped.indexOf('pluginReactLynx()')).toBeLessThan(
      wrapped.indexOf('rozeniteLynxPlugin()'),
    );
    assertValidSyntax(wrapped);
  });

  it('adds the plugin call to an empty plugins array', async () => {
    const configPath = await createConfigFile(FIXTURES.emptyPluginsArray);

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    expect(wrapped).toContain('rozeniteLynxPlugin(),');
    assertValidSyntax(wrapped);
  });

  it('handles an inline single-line plugins array, separating elements with a comma', async () => {
    const configPath = await createConfigFile(FIXTURES.inlinePluginsArray);

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    expect(wrapped).toContain('plugins: [pluginReactLynx(), rozeniteLynxPlugin(),]');
    assertValidSyntax(wrapped);
  });

  it('uses require() for a CommonJS config', async () => {
    const configPath = await createConfigFile(FIXTURES.commonjs, 'lynx.config.js');

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    expect(wrapped).toContain("const { rozeniteLynxPlugin } = require('@rozenite/lynx/rspeedy');");
    expect(wrapped).not.toContain("import { rozeniteLynxPlugin } from '@rozenite/lynx/rspeedy';");
    expect(wrapped).toContain('rozeniteLynxPlugin(),');
    assertValidSyntax(wrapped);
  });

  it('does not modify an already-wrapped config', async () => {
    const configPath = await createConfigFile(FIXTURES.alreadyWrapped);

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    expect(wrapped).toBe(FIXTURES.alreadyWrapped);
  });

  it('adds a second plugin call when the call is commented out, even though the import exists', async () => {
    const configPath = await createConfigFile(FIXTURES.commentedOutUsage);

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    // The commented-out call must stay untouched, and a real, active call
    // must be added -- an import with no live call is not "configured".
    expect(wrapped).toContain('// rozeniteLynxPlugin(),');
    expect(wrapped.match(/rozeniteLynxPlugin\(\)/g)?.length).toBe(2); // one commented, one live
    assertValidSyntax(wrapped);
  });

  it('throws when no lynx.config file exists', async () => {
    await expect(wrapLynxConfigFile(tempDir)).rejects.toThrow('lynx.config');
  });

  it('throws a descriptive error when no plugins array is found', async () => {
    await createConfigFile(FIXTURES.noPluginsArray);

    await expect(wrapLynxConfigFile(tempDir)).rejects.toThrow(/plugins.*array/i);
  });

  it('finds a lynx.config.js file when .ts is absent', async () => {
    const configPath = await createConfigFile(
      FIXTURES.basic.replace("'@lynx-js/rspeedy'", '"@lynx-js/rspeedy"'),
      'lynx.config.js',
    );

    await expect(wrapLynxConfigFile(tempDir)).resolves.not.toThrow();
    const wrapped = await fs.readFile(configPath, 'utf8');
    expect(wrapped).toContain('rozeniteLynxPlugin(),');
  });
});
