import * as path from 'node:path';
import { pluginCallstackTheme } from '@callstack/rspress-theme/plugin';
import { pluginLlms } from '@rspress/plugin-llms';
import { pluginOpenGraph } from 'rsbuild-plugin-open-graph';
import { defineConfig } from 'rspress/config';
import pluginSitemap from 'rspress-plugin-sitemap';
import { pluginDirectoryPlugin } from './plugins/plugin-directory';

export default defineConfig({
  root: path.join(__dirname, 'src'),
  title: 'Rozenite',
  icon: '/logo.svg',
  outDir: 'build',
  route: {
    cleanUrls: true,
  },
  logo: {
    light: '/logo-light.svg',
    dark: '/logo-dark.svg',
  },
  builderConfig: {
    plugins: [
      pluginOpenGraph({
        title: 'Rozenite',
        type: 'website',
        url: 'https://rozenite.dev',
        image: 'https://rozenite.dev/og-image.jpg',
        description:
          'Build powerful debugging tools and custom panels for React Native DevTools with type-safe, isomorphic communication',
        twitter: {
          site: '@callstack',
          card: 'summary_large_image',
        },
      }),
    ],
  },
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/callstackincubator/rozenite',
      },
      {
        icon: 'discord',
        mode: 'link',
        content: 'https://discord.gg/xgGt7KAjxv',
      },
    ],
    footer: {
      message: `Copyright © ${new Date().getFullYear()} Callstack Open Source`,
    },
  },
  globalStyles: path.join(__dirname, 'theme/styles.css'),
  plugins: [
    pluginCallstackTheme(),
    pluginLlms({
      exclude: ({ page }) => page.routePath.includes('404'),
    }),
    // @ts-expect-error outdated @rspress/shared declared as dependency
    pluginSitemap({ domain: 'https://rozenite.dev' }),
    pluginDirectoryPlugin(),
  ],
});
