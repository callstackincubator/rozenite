import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { wrapLynxConfigFile } from '../utils/config-wrapper.js';

const FIXTURES = {
  basic: `import { defineConfig } from '@lynx-js/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginReactLynx(),
  ],
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

    // Resulting file should still be syntactically balanced.
    const openBraces = (wrapped.match(/\{/g) || []).length;
    const closeBraces = (wrapped.match(/\}/g) || []).length;
    expect(openBraces).toBe(closeBraces);
    const openBrackets = (wrapped.match(/\[/g) || []).length;
    const closeBrackets = (wrapped.match(/\]/g) || []).length;
    expect(openBrackets).toBe(closeBrackets);
  });

  it('adds the plugin call to an empty plugins array', async () => {
    const configPath = await createConfigFile(FIXTURES.emptyPluginsArray);

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    expect(wrapped).toContain('rozeniteLynxPlugin(),');
  });

  it('handles an inline single-line plugins array', async () => {
    const configPath = await createConfigFile(FIXTURES.inlinePluginsArray);

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    expect(wrapped).toContain('plugins: [pluginReactLynx() rozeniteLynxPlugin(),]');
  });

  it('uses require() for a CommonJS config', async () => {
    const configPath = await createConfigFile(FIXTURES.commonjs, 'lynx.config.js');

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    expect(wrapped).toContain("const { rozeniteLynxPlugin } = require('@rozenite/lynx/rspeedy');");
    expect(wrapped).not.toContain("import { rozeniteLynxPlugin } from '@rozenite/lynx/rspeedy';");
    expect(wrapped).toContain('rozeniteLynxPlugin(),');
  });

  it('does not modify an already-wrapped config', async () => {
    const configPath = await createConfigFile(FIXTURES.alreadyWrapped);

    await wrapLynxConfigFile(tempDir);

    const wrapped = await fs.readFile(configPath, 'utf8');

    expect(wrapped).toBe(FIXTURES.alreadyWrapped);
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
