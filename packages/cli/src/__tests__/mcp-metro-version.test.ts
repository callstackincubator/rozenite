import { describe, expect, it } from 'vitest';
import { isSupportedReactNativeVersion } from '../commands/mcp/metro.js';

describe('mcp metro version guard', () => {
  it('accepts React Native 0.80+', () => {
    expect(isSupportedReactNativeVersion('0.80.0')).toBe(true);
    expect(isSupportedReactNativeVersion('0.81.2')).toBe(true);
    expect(isSupportedReactNativeVersion('1.0.0')).toBe(true);
  });

  it('rejects React Native below 0.80', () => {
    expect(isSupportedReactNativeVersion('0.79.9')).toBe(false);
    expect(isSupportedReactNativeVersion('0.76.0')).toBe(false);
  });

  it('rejects missing or malformed versions', () => {
    expect(isSupportedReactNativeVersion(undefined)).toBe(false);
    expect(isSupportedReactNativeVersion('')).toBe(false);
    expect(isSupportedReactNativeVersion('nightly')).toBe(false);
  });
});
