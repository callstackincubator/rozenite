// Every official plugin's page is built from its docs page. The build skips a lookup that no
// longer matches the docs (see plugin-docs.ts); here the same lookups run in strict mode, so a
// docs edit that breaks a page fails this test instead.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

import { pluginOrder } from './content';
import { agentTools, installs, pluginPage, screenshot, sortPlugins } from './plugin-docs';
import { pluginSchema } from './plugin-schema';

const docsDir = new URL('../content/docs/docs/official-plugins/', import.meta.url);
const publicDir = new URL('../../public/', import.meta.url);

const pages = readdirSync(docsDir)
  .filter((file) => file.endsWith('.mdx') && file !== 'overview.mdx')
  .map((file) => {
    const source = readFileSync(new URL(file, docsDir), 'utf8');
    const [, frontmatter, body] = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)!;
    return { slug: file.replace(/\.mdx$/, ''), data: parse(frontmatter), body };
  });

describe('official plugin pages', () => {
  it('lists every plugin in the home page order', () => {
    expect([...pluginOrder].sort()).toEqual(pages.map((p) => p.slug).sort());
  });

  it.each(pages)('builds $slug from its docs page', ({ slug, data, body }) => {
    const plugin = pluginSchema.parse(data.plugin);
    const page = pluginPage(slug, data.title, body, plugin, { strict: true });

    expect(page.pkg).toMatch(/^@rozenite\/[\w-]+$/);
    expect(page.install).toContain(page.pkg);
    expect(page.snippets).toHaveLength(plugin.setup.length);
    expect(page.screenshot).toBeDefined();
    expect(existsSync(new URL(page.screenshot!, publicDir))).toBe(true);
    if (page.tools.length > 0) expect(plugin.agent).toBeDefined();
  });
});

describe('reading a docs page', () => {
  const body = [
    "import PackageManagerTabs from '@/components/PackageManagerTabs.astro';",
    '![The panel](../../../../../public/demo-plugin.png)',
    '<PackageManagerTabs command="install -D @rozenite/demo-plugin" />',
    'Install the library you use:',
    '<PackageManagerTabs command="install lib-a" />',
    '<PackageManagerTabs command="install lib-b" />',
    '## Agent Tools (LLM Integration)',
    'Registers `list-things` and `get-thing`, takes `providerId` and `@rozenite/demo-plugin`.',
    '## Usage',
    'Mentions `not-a-tool` outside the agent section.',
  ].join('\n\n');

  it('reads installs with the sentence before them', () => {
    expect(installs(body)).toEqual([
      { command: 'npm install -D @rozenite/demo-plugin', note: undefined },
      { command: 'npm install lib-a', note: 'Install the library you use:' },
      { command: 'npm install lib-b', note: 'Install the library you use:' },
    ]);
  });

  it('reads the screenshot and agent tools', () => {
    expect(screenshot(body)).toBe('demo-plugin.png');
    expect(agentTools(body)).toEqual(['list-things', 'get-thing']);
  });

  it('warns instead of throwing outside strict mode', () => {
    const plugin = pluginSchema.parse(pages[0].data.plugin);
    const page = pluginPage('demo', 'Demo Plugin', body, {
      ...plugin,
      setup: [{ find: 'nothing', note: '' }],
    });
    expect(page.snippets).toEqual([]);
    expect(page.name).toBe('Demo');
    expect(() =>
      pluginPage(
        'demo',
        'Demo Plugin',
        body,
        { ...plugin, setup: [{ find: 'nothing', note: '' }] },
        { strict: true },
      ),
    ).toThrow(/no code block contains "nothing"/);
  });

  it('puts plugins missing from the order last, by name', () => {
    const list = [
      { slug: 'b', name: 'B' },
      { slug: 'z', name: 'Zed' },
      { slug: 'a', name: 'Alpha' },
    ];
    expect(sortPlugins(list, ['b']).map((p) => p.slug)).toEqual(['b', 'a', 'z']);
  });
});
