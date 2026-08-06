export type PluginTheme = 'light' | 'dark';

/**
 * Pure decision logic for the initial theme: an explicit stored preference
 * always wins, otherwise fall back to the OS/browser color scheme.
 *
 * Kept separate from any storage/media-query access so it can be unit
 * tested without touching `localStorage` or `matchMedia`.
 */
export function resolveInitialTheme(storedValue: string | null, prefersDark: boolean): PluginTheme {
  if (storedValue === 'light' || storedValue === 'dark') {
    return storedValue;
  }

  return prefersDark ? 'dark' : 'light';
}
