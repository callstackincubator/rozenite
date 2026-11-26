// The `plugin` frontmatter of an official plugin's docs page: the copy for its page at
// /plugins/<slug> and its cell on the home page. Everything else on those pages (name, package,
// install commands, code, screenshot, web support, agent tool names) is read from the docs page
// itself by plugin-docs.ts.
import { z } from 'astro/zod';

import { icons } from '../components/site/icons';

const item = z.object({ title: z.string(), body: z.string() });

export const pluginSchema = z.object({
  /** A pixel icon from components/site/icons.ts. */
  icon: z.enum(Object.keys(icons) as [keyof typeof icons, ...(keyof typeof icons)[]]),
  /** One line on what the panel shows, for the home page cell. */
  card: z.string(),
  /** Two-beat headline; the second beat is set in the accent. */
  headline: z.tuple([z.string(), z.string()]),
  lede: z.string(),
  /** Three, four or six, so the grid never ends on an empty cell. */
  features: z.array(item).refine((f) => [3, 4, 6].includes(f.length), {
    message: 'Give three, four or six features, so the grid has no empty cell',
  }),
  /** Code from this page to show: each entry picks the first code block containing `find`. */
  setup: z.array(z.object({ find: z.string(), note: z.string() })).min(1),
  /** What agents can do with the plugin. Tool names are read from the page's agent section. */
  agent: z.string().optional(),
  /** Limits and caveats worth knowing before installing. */
  notes: z.array(z.string()).optional(),
});

export type PluginFrontmatter = z.infer<typeof pluginSchema>;
