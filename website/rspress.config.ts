import { withCallstackPreset } from '@callstack/rspress-preset';
import { pluginDirectoryPlugin } from './plugins/plugin-directory';

const EDIT_ROOT_URL = `https://github.com/callstackincubator/rozenite/tree/main/website`;

export default withCallstackPreset(
  {
    context: __dirname,
    docs: {
      description:
        'Build powerful debugging tools and custom panels for React Native DevTools with type-safe, isomorphic communication',
      icon: '/logo.svg',
      logoDark: '/logo-dark.svg',
      logoLight: '/logo-light.svg',
      ogImage: '/og-image.jpg',
      rootDir: 'src',
      rootUrl: 'https://rozenite.dev',
      socials: {
        github: 'https://github.com/callstackincubator/rozenite',
        discord: 'https://discord.gg/xgGt7KAjxv',
      },
      title: 'Rozenite',
      editUrl: EDIT_ROOT_URL,
    },
  },
  {
    outDir: 'build',
    builderConfig: {},
    themeConfig: {
      enableScrollToTop: true,
    },
    plugins: [pluginDirectoryPlugin()],
  }
);
