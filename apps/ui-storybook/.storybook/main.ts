import type { StorybookConfig } from '@storybook/react-vite';

import { dirname } from 'path';

import { fileURLToPath } from 'url';

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      propFilter: (prop) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
    },
  },
  addons: [
    getAbsolutePath('@chromatic-com/storybook'),
    getAbsolutePath('@storybook/addon-vitest'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-mcp'),
  ],
  framework: getAbsolutePath('@storybook/react-vite'),
  // The docs site serves this build at /storybook. Vite's default relative
  // base (`./`) breaks when the page is requested without a trailing slash
  // (e.g. `/storybook`, which the site's `trailingSlash: false` Vercel
  // config produces), since relative asset paths then resolve against `/`
  // instead of `/storybook/`. An absolute base fixes the preview iframe
  // regardless of trailing slash.
  async viteFinal(config, { configType }) {
    const { mergeConfig } = await import('vite');
    return mergeConfig(config, {
      base: configType === 'PRODUCTION' ? '/storybook/' : '/',
    });
  },
  // The manager's own HTML (built separately from the Vite preview above)
  // always emits relative asset paths, so it needs the same fix via a
  // `<base>` tag placed before Storybook's default head content.
  managerHead: (head, { configType }) =>
    configType === 'PRODUCTION' ? `<base href="/storybook/" />\n${head}` : head,
};
export default config;
