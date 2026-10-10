// @ts-check
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLlmsTxt from 'starlight-llms-txt';

import { site as meta } from './src/site/content.ts';

const site = 'https://rozenite.dev';
const repo = 'https://github.com/callstackincubator/rozenite';
const description =
  'Plug-and-play DevTools panels for React Native and Lynx, with type-safe plugin APIs and runtime tools for agents.';

const doc = (name, label) => ({ label, slug: `docs/${name}` });
const group = (label, dir, items) => ({
  label,
  items: items.map(([name, itemLabel]) => doc(`${dir}/${name}`, itemLabel)),
});

export default defineConfig({
  site,
  // Same output shape as the Rspress site: `docs/introduction.html`, `404.html`.
  outDir: './build',
  trailingSlash: 'never',
  build: { format: 'file' },
  devToolbar: { enabled: false },
  integrations: [
    // Starlight would add the sitemap itself; listed so the pages outside Starlight are included.
    // Left out: the DevTools welcome page (noindex) and /plugin-directory/1, a copy of
    // /plugin-directory. The 404 is never listed.
    sitemap({
      filter: (page) => !['/welcome', '/plugin-directory/1'].includes(new URL(page).pathname),
    }),
    starlight({
      title: 'Rozenite',
      description,
      favicon: '/favicon.svg',
      // src/pages/404.astro replaces Starlight's 404, in the site's look (docs/DESIGN.md).
      disable404Route: true,
      // Per-page descriptions and breadcrumbs for docs pages.
      routeMiddleware: './src/routeData.ts',
      // The look follows docs/DESIGN.md: the same tokens, fonts and lockup as the landing pages.
      customCss: ['./src/fonts/font-face.css', './src/styles/theme.css', './src/styles/docs.css'],
      components: {
        ThemeProvider: './src/components/starlight/ThemeProvider.astro',
        SiteTitle: './src/components/starlight/SiteTitle.astro',
        SocialIcons: './src/components/starlight/SocialIcons.astro',
        Footer: './src/components/starlight/Footer.astro',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: repo },
        { icon: 'discord', label: 'Discord', href: 'https://discord.gg/xgGt7KAjxv' },
      ],
      editLink: { baseUrl: `${repo}/edit/main/website/src/content/docs/` },
      head: [
        // Starlight sets og:title, og:description and a large Twitter card, but no image.
        { tag: 'meta', attrs: { property: 'og:image', content: `${site}/og-image.jpg` } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: meta.ogAlt } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: `${site}/og-image.jpg` } },
        { tag: 'meta', attrs: { name: 'twitter:image:alt', content: meta.ogAlt } },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#0a0a0a' } },
        { tag: 'link', attrs: { rel: 'icon', href: '/favicon-32.png', type: 'image/png', sizes: '32x32' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
        { tag: 'link', attrs: { rel: 'alternate', type: 'text/plain', title: 'llms.txt', href: '/llms.txt' } },
      ],
      sidebar: [
        doc('introduction', 'Introduction'),
        doc('prior-art', 'Prior Art'),
        doc('getting-started', 'Getting started'),
        doc('compatibility', 'Compatibility'),
        group('Targets', 'targets', [
          ['rozenite-for-lynx', 'Rozenite for Lynx'],
          ['rozenite-for-web', 'Rozenite for Web'],
        ]),
        group('Rozenite for Agents', 'agent', [
          ['overview', 'Overview'],
          ['skills', 'Agent Skills'],
          ['adding-tools-to-your-application', 'Adding tools to your application'],
          ['making-your-plugin-agent-enabled', 'Making your plugin agent-enabled'],
          ['sdk', 'Agent SDK'],
          ['tap', 'Tap'],
        ]),
        doc('standalone-app', 'Standalone App'),
        {
          label: 'Plugin Development',
          items: [
            doc('plugin-development/overview', 'Overview'),
            doc('plugin-development/plugin-development', 'Plugin Development Guide'),
            doc('plugin-development/rpc', 'RPC'),
            doc('plugin-development/testing', 'Testing'),
            { label: 'Rozenite UI Storybook', link: '/storybook' },
          ],
        },
        group('Official Plugins', 'official-plugins', [
          ['overview', 'Overview'],
          ['expo-atlas', 'Expo Atlas'],
          ['tanstack-query', 'TanStack Query'],
          ['react-navigation', 'React Navigation'],
          ['network-activity', 'Network Activity'],
          ['overlay', 'Overlay'],
          ['redux-devtools', 'Redux DevTools'],
          ['performance-monitor', 'Performance Monitor'],
          ['storage', 'Storage'],
          ['feature-flags', 'Feature Flags'],
          ['sqlite', 'SQLite'],
          ['file-system', 'File System'],
          ['react-hook-form', 'React Hook Form'],
          ['controls', 'Controls'],
          ['require-profiler', 'Require Profiler'],
        ]),
      ],
      plugins: [
        starlightLlmsTxt({
          projectName: 'Rozenite',
          description,
        }),
      ],
    }),
  ],
});
