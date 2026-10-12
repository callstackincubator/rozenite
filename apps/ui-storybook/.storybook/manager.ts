import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

const prefersDark =
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

// The rozenite.dev look (docs/DESIGN.md): near-black, one crimson-rose accent, neutral greys,
// square corners. Values mirror the panel tokens in packages/ui/styles.css; light mode uses the
// deeper crimson because the bright accent is too pale for text on white.
const palette = prefersDark
  ? {
      base: 'dark' as const,
      accent: '#ff4f7b',
      background: '#0a0a0a',
      surface: '#111111',
      field: '#161616',
      line: '#1f1f1f',
      lineStrong: '#313131',
      text: '#ffffff',
      muted: '#a3a3a3',
      onAccent: '#0a0a0a',
    }
  : {
      base: 'light' as const,
      accent: '#c2143f',
      background: '#ffffff',
      surface: '#f9f9f8',
      field: '#f6f6f5',
      line: '#e6e6e6',
      lineStrong: '#d1d1d1',
      text: '#0a0a0a',
      muted: '#5e5e5e',
      onAccent: '#ffffff',
    };

addons.setConfig({
  theme: create({
    base: palette.base,
    brandTitle: 'Rozenite UI',
    // Relative so it still resolves correctly when this build is served
    // under a subpath (e.g. /storybook) via the <base> tag in main.ts. The
    // mark and the wordmark block keep the bright accent in both themes.
    brandImage: './logo.svg',
    brandUrl: 'https://rozenite.dev',
    brandTarget: '_blank',

    colorPrimary: palette.accent,
    colorSecondary: palette.accent,

    // Fonts are declared in main.ts (managerHead) and served from packages/ui/fonts.
    fontBase: "'Switzer', Arial, sans-serif",
    fontCode: "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace",

    appBg: palette.surface,
    appContentBg: palette.background,
    appPreviewBg: palette.background,
    appBorderColor: palette.line,
    appBorderRadius: 0,

    textColor: palette.text,
    textInverseColor: palette.onAccent,
    textMutedColor: palette.muted,

    barTextColor: palette.muted,
    barHoverColor: palette.text,
    barSelectedColor: palette.accent,
    barBg: palette.background,

    buttonBg: palette.field,
    buttonBorder: palette.lineStrong,
    booleanBg: palette.field,
    booleanSelectedBg: palette.background,

    inputBg: palette.field,
    inputBorder: palette.lineStrong,
    inputTextColor: palette.text,
    inputBorderRadius: 0,
  }),
});
