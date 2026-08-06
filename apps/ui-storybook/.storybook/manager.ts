import { addons } from 'storybook/manager-api';
import { create, themes } from 'storybook/theming';

const prefersDark =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

addons.setConfig({
  theme: create({
    ...themes.normal,
    brandTitle: 'Rozenite UI',
    brandImage: prefersDark ? '/logo-dark.svg' : '/logo-light.svg',
    brandUrl: 'https://rozenite.dev',
    brandTarget: '_blank',
  }),
});
