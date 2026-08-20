import { describe, expect, it } from 'vitest';
import type { Plugin } from 'vite';
import { rozenitePlugin } from '../src/index.js';

describe('rozenitePlugin', () => {
  it('configures Tailwind CSS for client panels', () => {
    const [tailwindPlugins] = rozenitePlugin();

    expect(Array.isArray(tailwindPlugins)).toBe(true);
    expect((tailwindPlugins as Plugin[]).map((plugin) => plugin.name)).toEqual([
      '@tailwindcss/vite:scan',
      '@tailwindcss/vite:generate:serve',
      '@tailwindcss/vite:generate:build',
    ]);
  });

  it('allows Tailwind CSS to be disabled for client panels', () => {
    const plugins = rozenitePlugin({ tailwind: false });

    expect(plugins.flat(Infinity)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: '@tailwindcss/vite:scan' })]),
    );
  });
});
