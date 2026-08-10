import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';
import { createTheme, type ColorScheme, type Theme } from './tokens';

export type ThemeContextValue = {
  theme: Theme;
  scheme: ColorScheme;
  setScheme: (scheme: ColorScheme) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const resolveScheme = (): ColorScheme =>
  Appearance.getColorScheme() === 'light' ? 'light' : 'dark';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [scheme, setScheme] = useState<ColorScheme>(resolveScheme);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme === 'light' ? 'light' : 'dark');
    });

    return () => subscription.remove();
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: createTheme(scheme),
      scheme,
      setScheme,
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
