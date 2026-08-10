// Design tokens ported 1:1 from `packages/ui/styles.css`.
// Keep these in sync with that file if the shared design system changes.

export type ColorScheme = 'light' | 'dark';

export type ColorTokens = {
  background: string;
  card: string;
  popover: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
};

const dark: ColorTokens = {
  background: '#201f24',
  card: '#201f24',
  popover: '#2b2a2f',
  foreground: '#ffffff',
  primary: '#8232ff',
  primaryForeground: '#ffffff',
  secondary: '#2b2a2f',
  secondaryForeground: '#ffffff',
  muted: '#2b2a2f',
  mutedForeground: '#cfced5',
  accent: '#8232ff33',
  accentForeground: '#ffffff',
  destructive: '#fa7171',
  destructiveForeground: '#201f24',
  border: '#424145',
  input: '#424145',
  ring: '#8232ff',
};

const light: ColorTokens = {
  background: '#ffffff',
  card: '#ffffff',
  popover: '#ffffff',
  foreground: '#201f24',
  primary: '#8232ff',
  primaryForeground: '#ffffff',
  secondary: '#f9f8fd',
  secondaryForeground: '#201f24',
  muted: '#f9f8fd',
  mutedForeground: '#838289',
  accent: '#8232ff29',
  accentForeground: '#201f24',
  destructive: '#fa7171',
  destructiveForeground: '#201f24',
  border: '#cfced5',
  input: '#cfced5',
  ring: '#8232ff',
};

export const palettes: Record<ColorScheme, ColorTokens> = { light, dark };

// Square design language: radius is always 0.
export const radius = 0;

export const spacing = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  '4xl': 32,
} as const;

export const controlHeight = {
  sm: 24,
  md: 28,
  lg: 32,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
} as const;

export const fontFamily = 'System';

export type Theme = {
  scheme: ColorScheme;
  colors: ColorTokens;
  radius: typeof radius;
  spacing: typeof spacing;
  controlHeight: typeof controlHeight;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  fontFamily: typeof fontFamily;
};

export const createTheme = (scheme: ColorScheme): Theme => ({
  scheme,
  colors: palettes[scheme],
  radius,
  spacing,
  controlHeight,
  fontSize,
  fontWeight,
  fontFamily,
});
