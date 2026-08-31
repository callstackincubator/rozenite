import { describe, expect, it } from 'vitest';
import { resolveFramework } from './framework';

describe('resolveFramework', () => {
  it('reads Lynx from the integration name the lynx-dev bridge sends', () => {
    expect(
      // `platform` is the device OS on Lynx too, and the device probe
      // cannot see Lynx at all, so the integration name is the only thing
      // that can say "Lynx" here.
      resolveFramework({ integrationName: 'Lynx', platform: 'ios', isWebTarget: false }),
    ).toBe('Lynx');
  });

  it('keeps reading Lynx even though the probe reports a browser', () => {
    // A Lynx card opened in a browser is still Lynx. The integration name
    // outranks the probe precisely so the web axis cannot rename it.
    expect(resolveFramework({ integrationName: 'Lynx', platform: 'web', isWebTarget: true })).toBe(
      'Lynx',
    );
  });

  it('reads a browser page as Web when the device says it is one', () => {
    expect(
      resolveFramework({ integrationName: 'Rozenite', platform: 'web', isWebTarget: true }),
    ).toBe('Web');
  });

  it("reads React Native's own host integrations as React Native", () => {
    expect(
      resolveFramework({
        integrationName: 'iOS Bridge (RCTBridge)',
        platform: 'ios',
        isWebTarget: false,
      }),
    ).toBe('React Native');
    expect(
      resolveFramework({
        integrationName: 'Android Bridgeless (ReactHostImpl)',
        platform: 'android',
        isWebTarget: false,
      }),
    ).toBe('React Native');
  });

  // The probe is the same signal that decides the target's
  // `RozeniteIntegration`. Preferring it here is what stops the label and
  // the compatibility gate from disagreeing about whether it is a browser.
  it('prefers the device probe over the platform field when the two disagree', () => {
    expect(resolveFramework({ platform: 'web', isWebTarget: false })).toBe('React Native');
    expect(resolveFramework({ platform: 'ios', isWebTarget: true })).toBe('Web');
  });

  it('falls back to the reported platform only while the probe is unknown', () => {
    expect(resolveFramework({ platform: 'web', isWebTarget: null })).toBe('Web');
    expect(resolveFramework({ platform: 'ios', isWebTarget: null })).toBe('React Native');
  });

  it('falls back to React Native for signals it cannot read at all', () => {
    expect(resolveFramework({ isWebTarget: null })).toBe('React Native');
    expect(resolveFramework({ integrationName: 42, platform: null, isWebTarget: null })).toBe(
      'React Native',
    );
  });
});
