import { describe, expect, it } from 'vitest';
import { getFrameworkFromMetadata } from './framework';

describe('getFrameworkFromMetadata', () => {
  it('reads Lynx from the integration name the lynx-dev bridge sends', () => {
    expect(
      // `platform` is the device OS on Lynx too, so the integration name
      // is the only thing that can say "Lynx" here.
      getFrameworkFromMetadata({ integrationName: 'Lynx', platform: 'ios' }),
    ).toBe('Lynx');
  });

  it('reads a browser page as Web — the platform the Chrome extension reports', () => {
    expect(getFrameworkFromMetadata({ integrationName: 'Rozenite', platform: 'web' })).toBe('Web');
  });

  it("reads React Native's own host integrations as React Native", () => {
    expect(
      getFrameworkFromMetadata({ integrationName: 'iOS Bridge (RCTBridge)', platform: 'ios' }),
    ).toBe('React Native');
    expect(
      getFrameworkFromMetadata({
        integrationName: 'Android Bridgeless (ReactHostImpl)',
        platform: 'android',
      }),
    ).toBe('React Native');
  });

  it('falls back to React Native for metadata it cannot read at all', () => {
    expect(getFrameworkFromMetadata({})).toBe('React Native');
    expect(getFrameworkFromMetadata({ integrationName: 42, platform: null })).toBe('React Native');
  });
});
