import { describe, it, expect } from 'vitest';
import {
  ROZENITE_INTEGRATIONS,
  DEFAULT_PLUGIN_INTEGRATIONS,
  isRozeniteIntegration,
  resolveIntegration,
} from '../integration.js';

describe('isRozeniteIntegration', () => {
  it('accepts every declared integration id', () => {
    for (const integration of ROZENITE_INTEGRATIONS) {
      expect(isRozeniteIntegration(integration)).toBe(true);
    }
  });

  it('rejects unknown strings, non-strings, and undefined', () => {
    expect(isRozeniteIntegration('react-native-cli')).toBe(false);
    expect(isRozeniteIntegration('')).toBe(false);
    expect(isRozeniteIntegration(undefined)).toBe(false);
    expect(isRozeniteIntegration(null)).toBe(false);
    expect(isRozeniteIntegration(42)).toBe(false);
    expect(isRozeniteIntegration({})).toBe(false);
  });
});

describe('DEFAULT_PLUGIN_INTEGRATIONS', () => {
  it('defaults an unlabeled plugin to React Native only', () => {
    expect(DEFAULT_PLUGIN_INTEGRATIONS).toEqual(['react-native']);
  });
});

describe('resolveIntegration', () => {
  // Exhaustive over the table in the PR description: host x targetPlatform.
  const nonWebPlatforms: unknown[] = ['ios', 'android', 'anything-else', undefined, null, 42, {}];

  describe('host: react-native', () => {
    it.each(nonWebPlatforms)('resolves %j to react-native', (platform) => {
      expect(resolveIntegration('react-native', platform)).toBe('react-native');
    });

    it('resolves "web" to react-native-web', () => {
      expect(resolveIntegration('react-native', 'web')).toBe('react-native-web');
    });
  });

  describe('host: lynx', () => {
    it.each(nonWebPlatforms)('resolves %j to lynx', (platform) => {
      expect(resolveIntegration('lynx', platform)).toBe('lynx');
    });

    it('resolves "web" to lynx-web', () => {
      expect(resolveIntegration('lynx', 'web')).toBe('lynx-web');
    });
  });
});
