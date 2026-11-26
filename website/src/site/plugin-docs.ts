// Builds an official plugin's page from its docs page: the `plugin` frontmatter gives the copy,
// and the rest is read from the Markdown body, so the docs stay the one place to change it.
//
// CI skips changes that only touch website/, so a build that threw here would first fail when a
// release deploys the site. The pages build in lenient mode instead: a lookup that no longer
// matches the docs is left out with a warning. plugin-pages.test.ts runs every page in strict
// mode, where the same miss throws.
import type { IconName } from '../components/site/icons';
import type { PluginFrontmatter } from './plugin-schema';

export type Snippet = { title: string; lang: string; code: string; note: string };
export type Install = { command: string; note?: string };

export type PluginPage = PluginFrontmatter & {
  slug: string;
  name: string;
  pkg: string;
  icon: IconName;
  /** This plugin's page on the site. */
  href: string;
  /** Its docs page. */
  docs: string;
  /** The plugin's own install. */
  install: string;
  /** Other installs the docs ask for (adapters, peer libraries), with the sentence before them. */
  extraInstalls: Install[];
  snippets: Snippet[];
  /** The panel screenshot's file name in public/, when the docs page shows one. */
  screenshot?: string;
  /** The docs page has a Rozenite for Web section. */
  web: boolean;
  /** Tool names listed in the docs page's agent section. */
  tools: string[];
};

type Options = { strict?: boolean };

const fail = (strict: boolean | undefined, message: string) => {
  if (strict) throw new Error(message);
  console.warn(`[plugin pages] ${message}`);
};

/** Every `<PackageManagerTabs>` command, with the prose paragraph above it. */
export function installs(body: string): Install[] {
  const out: Install[] = [];
  let note: string | undefined;
  for (const block of body.split(/\n\s*\n/).map((b) => b.trim())) {
    const tabs = block.match(/^<PackageManagerTabs command="([^"]+)"/);
    if (tabs) out.push({ command: `npm ${tabs[1]}`, note });
    else if (block && !/^(import |```|#|!\[|:::|<)/.test(block)) note = block;
  }
  return out;
}

/** The first fenced code block that contains `needle`. */
export function snippet(body: string, needle: string): Omit<Snippet, 'note'> | undefined {
  for (const [, lang, title, code] of body.matchAll(
    /^```(\w+)(?: title="([^"]+)")?\n([\s\S]*?)\n```$/gm,
  )) {
    if (!code.includes(needle)) continue;
    // Docs fence some TSX files as `typescript`. A block without a file name gets no title.
    return { title: title ?? '', lang: title?.endsWith('.tsx') ? 'tsx' : lang, code };
  }
  return undefined;
}

/** The file name of the first image the page shows from public/. */
export function screenshot(body: string): string | undefined {
  return body.match(/^!\[[^\]]*\]\((?:\.\.\/)+public\/([^)]+)\)/m)?.[1];
}

/** Kebab-case names in backticks under the page's agent heading: the tools it registers. */
export function agentTools(body: string): string[] {
  const section = body.match(/^## [^\n]*(?:Agent|LLM)[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1];
  if (!section) return [];
  const names = [...section.matchAll(/`([a-z]+(?:-[a-z]+)+)`/g)].map((m) => m[1]);
  return [...new Set(names)];
}

export function pluginPage(
  slug: string,
  title: string,
  body: string,
  plugin: PluginFrontmatter,
  { strict }: Options = {},
): PluginPage {
  const [first, ...extraInstalls] = installs(body);
  const pkg = first?.command.match(/@rozenite\/[\w-]+/)?.[0];
  if (!first || !pkg) throw new Error(`${slug}: no install command for an @rozenite package`);

  const snippets = plugin.setup.flatMap(({ find, note }) => {
    const found = snippet(body, find);
    if (!found) fail(strict, `${slug}: no code block contains "${find}"`);
    return found ? [{ ...found, note }] : [];
  });

  return {
    ...plugin,
    slug,
    name: title.replace(/ Plugin$/, ''),
    pkg,
    href: `/plugins/${slug}`,
    docs: `/docs/official-plugins/${slug}`,
    install: first.command,
    extraInstalls,
    snippets,
    screenshot: screenshot(body),
    web: /^## Web \(React Native for Web\)/m.test(body),
    tools: agentTools(body),
  };
}

/** Official plugins in the editorial order; plugins missing from it follow, by name. */
export function sortPlugins<T extends { slug: string; name: string }>(list: T[], order: string[]) {
  const rank = (p: T) => (order.includes(p.slug) ? order.indexOf(p.slug) : order.length);
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
