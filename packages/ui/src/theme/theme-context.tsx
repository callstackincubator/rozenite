import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { type PluginTheme, resolveInitialTheme } from './resolve-theme';

const STORAGE_KEY = '@rozenite/ui:theme';

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredTheme(theme: PluginTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable (e.g. disabled cookies) — theme just
    // won't persist across sessions.
  }
}

function prefersDarkColorScheme(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

type PluginThemeContextValue = {
  theme: PluginTheme;
  setTheme: (theme: PluginTheme) => void;
  toggleTheme: () => void;
};

const PluginThemeContext = createContext<PluginThemeContextValue | null>(null);

export type PluginThemeProviderProps = {
  children: ReactNode;
};

export function PluginThemeProvider({ children }: PluginThemeProviderProps) {
  const [theme, setThemeState] = useState<PluginTheme>(() =>
    resolveInitialTheme(readStoredTheme(), prefersDarkColorScheme()),
  );

  const setTheme = useCallback((next: PluginTheme) => {
    setThemeState(next);
    writeStoredTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <PluginThemeContext.Provider value={value}>
      {children}
    </PluginThemeContext.Provider>
  );
}

export function usePluginTheme(): PluginThemeContextValue {
  const context = useContext(PluginThemeContext);

  if (!context) {
    throw new Error('usePluginTheme must be used within a PluginShell');
  }

  return context;
}
