import type { ComponentPropsWithoutRef } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { cn } from '../utils/cn.js';

const THEME_CLASS_NAME = 'dark';
const THEME_ATTR_NAME = 'data-theme';
const SYSTEM_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export const SHARED_THEME_STORAGE_KEY = '@rozenite/theme';

type AppliedThemeName = 'light' | 'dark' | 'default';

export type PluginThemeName = 'light' | 'dark' | 'default' | 'system';

export type PluginThemeProps = ComponentPropsWithoutRef<'div'> & {
  theme?: PluginThemeName;
  defaultTheme?: PluginThemeName;
  onThemeChange?: (theme: PluginThemeName) => void;
  storageKey?: string;
  syncDocument?: boolean;
};

export type PluginThemeContextValue = {
  theme: PluginThemeName;
  resolvedTheme: AppliedThemeName;
  setTheme: (theme: PluginThemeName) => void;
};

type ThemeSnapshot = {
  htmlTheme: string | null;
  bodyTheme: string | null;
  htmlHasDarkClass: boolean;
  bodyHasDarkClass: boolean;
};

const PluginThemeContext = createContext<PluginThemeContextValue | null>(null);

const isPluginThemeName = (value: string | null): value is PluginThemeName =>
  value === 'light' ||
  value === 'dark' ||
  value === 'default' ||
  value === 'system';

const getSystemTheme = (): Exclude<AppliedThemeName, 'default'> => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia(SYSTEM_THEME_MEDIA_QUERY).matches
    ? 'dark'
    : 'light';
};

const getResolvedTheme = (
  theme: PluginThemeName,
  systemTheme: Exclude<AppliedThemeName, 'default'>,
): AppliedThemeName => {
  if (theme === 'system') {
    return systemTheme;
  }

  return theme;
};

const readStoredTheme = (
  storageKey: string | undefined,
  fallbackTheme: PluginThemeName,
) => {
  if (!storageKey || typeof window === 'undefined') {
    return fallbackTheme;
  }

  const storedTheme = window.localStorage.getItem(storageKey);
  return isPluginThemeName(storedTheme) ? storedTheme : fallbackTheme;
};

const setTheme = (element: HTMLElement, theme: AppliedThemeName) => {
  element.setAttribute(THEME_ATTR_NAME, theme);

  if (theme === 'dark') {
    element.classList.add(THEME_CLASS_NAME);
  } else {
    element.classList.remove(THEME_CLASS_NAME);
  }
};

const restoreTheme = (
  element: HTMLElement,
  theme: string | null,
  hasDarkClass: boolean,
) => {
  if (theme === null) {
    element.removeAttribute(THEME_ATTR_NAME);
  } else {
    element.setAttribute(THEME_ATTR_NAME, theme);
  }

  if (hasDarkClass) {
    element.classList.add(THEME_CLASS_NAME);
  } else {
    element.classList.remove(THEME_CLASS_NAME);
  }
};

const snapshotTheme = (): ThemeSnapshot => ({
  htmlTheme: document.documentElement.getAttribute(THEME_ATTR_NAME),
  bodyTheme: document.body.getAttribute(THEME_ATTR_NAME),
  htmlHasDarkClass: document.documentElement.classList.contains(
    THEME_CLASS_NAME,
  ),
  bodyHasDarkClass: document.body.classList.contains(THEME_CLASS_NAME),
});

export function PluginTheme({
  theme,
  defaultTheme = 'default',
  onThemeChange,
  storageKey = SHARED_THEME_STORAGE_KEY,
  syncDocument = true,
  className,
  children,
  ...props
}: PluginThemeProps) {
  const [uncontrolledTheme, setUncontrolledTheme] = useState<PluginThemeName>(
    () => readStoredTheme(storageKey, defaultTheme),
  );
  const [systemTheme, setSystemTheme] = useState<
    Exclude<AppliedThemeName, 'default'>
  >(() => getSystemTheme());
  const selectedTheme = theme ?? uncontrolledTheme;
  const resolvedTheme = getResolvedTheme(selectedTheme, systemTheme);

  const updateTheme = useCallback(
    (nextTheme: PluginThemeName) => {
      if (theme === undefined) {
        setUncontrolledTheme(nextTheme);
      }

      if (storageKey && typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, nextTheme);
      }

      onThemeChange?.(nextTheme);
    },
    [onThemeChange, storageKey, theme],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQueryList = window.matchMedia(SYSTEM_THEME_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    setSystemTheme(mediaQueryList.matches ? 'dark' : 'light');

    mediaQueryList.addEventListener('change', handleChange);
    return () => {
      mediaQueryList.removeEventListener('change', handleChange);
    };
  }, []);

  // Sync theme across plugin panels when changed in another panel (cross-frame/tab)
  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      return;
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== storageKey || event.newValue === null) {
        return;
      }

      if (isPluginThemeName(event.newValue) && theme === undefined) {
        setUncontrolledTheme(event.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [storageKey, theme]);

  useLayoutEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, selectedTheme);
    }
  }, [selectedTheme, storageKey]);

  useLayoutEffect(() => {
    if (!syncDocument) {
      return;
    }

    const previousTheme = snapshotTheme();

    setTheme(document.documentElement, resolvedTheme);
    setTheme(document.body, resolvedTheme);

    return () => {
      restoreTheme(
        document.documentElement,
        previousTheme.htmlTheme,
        previousTheme.htmlHasDarkClass,
      );
      restoreTheme(
        document.body,
        previousTheme.bodyTheme,
        previousTheme.bodyHasDarkClass,
      );
    };
  }, [resolvedTheme, syncDocument]);

  const contextValue = useMemo<PluginThemeContextValue>(
    () => ({
      theme: selectedTheme,
      resolvedTheme,
      setTheme: updateTheme,
    }),
    [resolvedTheme, selectedTheme, updateTheme],
  );

  return (
    <PluginThemeContext.Provider value={contextValue}>
      <div
        data-theme={resolvedTheme}
        className={cn(
          resolvedTheme === 'dark' && THEME_CLASS_NAME,
          'min-h-0',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </PluginThemeContext.Provider>
  );
}

export function usePluginTheme(): PluginThemeContextValue {
  const context = useContext(PluginThemeContext);

  if (!context) {
    throw new Error('usePluginTheme must be used within a PluginTheme.');
  }

  return context;
}
