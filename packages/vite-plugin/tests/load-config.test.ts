import { describe, expect, it } from 'vitest';
import { resolveIntegrations, type RozeniteConfig } from '../src/load-config.js';

const baseConfig: RozeniteConfig = { panels: [] };

describe('resolveIntegrations', () => {
  it('defaults to ["react-native"] when integrations is omitted', () => {
    expect(resolveIntegrations(baseConfig)).toEqual(['react-native']);
  });

  it('returns the declared list when it is valid', () => {
    const config: RozeniteConfig = {
      ...baseConfig,
      integrations: ['react-native', 'lynx-web'],
    };

    expect(resolveIntegrations(config)).toEqual(['react-native', 'lynx-web']);
  });

  it('throws naming the offending value for an unknown integration id', () => {
    const config: RozeniteConfig = {
      ...baseConfig,
      integrations: ['react-native', 'react-natvie'] as RozeniteConfig['integrations'],
    };

    expect(() => resolveIntegrations(config)).toThrow(/"react-natvie"/);
    expect(() => resolveIntegrations(config)).toThrow(
      /react-native, react-native-web, lynx, lynx-web/,
    );
  });

  it('throws for an empty declared list rather than silently defaulting', () => {
    const config: RozeniteConfig = { ...baseConfig, integrations: [] };

    expect(() => resolveIntegrations(config)).toThrow(/must not be empty/);
  });
});
