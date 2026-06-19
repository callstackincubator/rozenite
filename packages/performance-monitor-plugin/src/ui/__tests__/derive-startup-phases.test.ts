import { describe, expect, it } from 'vitest';
import { deriveStartupPhases } from '../derive-startup-phases';
import type { SerializedPerformanceReactNativeMark } from '../../shared/types';

const mark = (
  name: string,
  startTime: number,
  detail?: unknown,
): SerializedPerformanceReactNativeMark => ({
  name,
  startTime,
  duration: 0,
  entryType: 'react-native-mark',
  detail,
});

describe('deriveStartupPhases', () => {
  it('pairs Start/End marks into a measure with the right duration', () => {
    const result = deriveStartupPhases([
      mark('nativeLaunchStart', 100),
      mark('nativeLaunchEnd', 250),
    ]);

    expect(result).toEqual([
      {
        name: 'nativeLaunch',
        startTime: 100,
        duration: 150,
        entryType: 'measure',
        detail: undefined,
        derivedFromReactNativeMark: true,
      },
    ]);
  });

  it('handles multiple paired phases independently', () => {
    const result = deriveStartupPhases([
      mark('nativeLaunchStart', 100),
      mark('nativeLaunchEnd', 250),
      mark('runJSBundleStart', 300),
      mark('runJSBundleEnd', 700),
    ]);

    expect(result.map((m) => m.name)).toEqual(['nativeLaunch', 'runJSBundle']);
    expect(result.map((m) => m.duration)).toEqual([150, 400]);
  });

  it('does not synthesize a measure when only the Start exists', () => {
    const result = deriveStartupPhases([mark('nativeLaunchStart', 100)]);
    expect(result).toEqual([]);
  });

  it('does not synthesize a measure when only the End exists', () => {
    const result = deriveStartupPhases([mark('nativeLaunchEnd', 250)]);
    expect(result).toEqual([]);
  });

  it('leaves marks that match neither suffix alone (e.g. appStartup)', () => {
    const result = deriveStartupPhases([
      mark('appStartup', 50),
      mark('nativeLaunchStart', 100),
      mark('nativeLaunchEnd', 250),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('nativeLaunch');
  });

  it('carries detail from the Start mark forward', () => {
    const detail = { phase: 'native' };
    const result = deriveStartupPhases([
      mark('nativeLaunchStart', 100, detail),
      mark('nativeLaunchEnd', 250),
    ]);

    expect(result[0].detail).toBe(detail);
  });
});
