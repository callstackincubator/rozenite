import { describe, expect, it } from 'vitest';
import { deriveStartupSummary } from '../derive-startup-summary';
import type { SerializedPerformanceReactNativeMark } from '../../shared/types';

const mark = (
  name: string,
  startTime: number,
): SerializedPerformanceReactNativeMark => ({
  name,
  startTime,
  duration: 0,
  entryType: 'react-native-mark',
});

const ALL_MARKS = [
  mark('nativeLaunchStart', 100),
  mark('nativeLaunchEnd', 300),
  mark('runJSBundleStart', 300),
  mark('runJSBundleEnd', 600),
  mark('initialMountStart', 600),
  mark('initialMountEnd', 900),
];

describe('deriveStartupSummary', () => {
  describe('all three phases complete', () => {
    it('returns correct durations for each phase', () => {
      const { phases } = deriveStartupSummary(ALL_MARKS);
      const [native, js, mount] = phases;
      expect(native).toMatchObject({ name: 'nativeLaunch', status: 'complete', duration: 200 });
      expect(js).toMatchObject({ name: 'runJSBundle', status: 'complete', duration: 300 });
      expect(mount).toMatchObject({ name: 'initialMount', status: 'complete', duration: 300 });
    });

    it('returns correct total duration', () => {
      const { total } = deriveStartupSummary(ALL_MARKS);
      expect(total).toEqual({ status: 'complete', duration: 800 });
    });

    it('always returns the three known phases in order', () => {
      const { phases } = deriveStartupSummary(ALL_MARKS);
      expect(phases.slice(0, 3).map((p) => p.name)).toEqual([
        'nativeLaunch',
        'runJSBundle',
        'initialMount',
      ]);
    });
  });

  describe('incomplete pairs (in-progress)', () => {
    it('marks a phase in-progress when only the Start mark has arrived', () => {
      const { phases } = deriveStartupSummary([
        mark('nativeLaunchStart', 100),
        mark('nativeLaunchEnd', 300),
        mark('runJSBundleStart', 300),
        // runJSBundleEnd missing
      ]);
      const js = phases.find((p) => p.name === 'runJSBundle')!;
      expect(js.status).toBe('in-progress');
      expect(js.duration).toBeUndefined();
    });

    it('records startTime on an in-progress phase', () => {
      const { phases } = deriveStartupSummary([mark('nativeLaunchStart', 100)]);
      const native = phases.find((p) => p.name === 'nativeLaunch')!;
      expect(native.startTime).toBe(100);
    });
  });

  describe('missing phases', () => {
    it('marks a phase missing when neither Start nor End arrived', () => {
      const { phases } = deriveStartupSummary([
        mark('runJSBundleStart', 300),
        mark('runJSBundleEnd', 600),
      ]);
      const native = phases.find((p) => p.name === 'nativeLaunch')!;
      const mount = phases.find((p) => p.name === 'initialMount')!;
      expect(native.status).toBe('missing');
      expect(mount.status).toBe('missing');
    });

    it('returns total missing when no marks arrived at all', () => {
      const { total } = deriveStartupSummary([]);
      expect(total.status).toBe('missing');
    });

    it('returns total missing when nativeLaunchStart is absent', () => {
      const { total } = deriveStartupSummary([
        mark('runJSBundleStart', 300),
        mark('runJSBundleEnd', 600),
      ]);
      expect(total.status).toBe('missing');
    });

    it('returns all three known phases as missing for empty input', () => {
      const { phases } = deriveStartupSummary([]);
      expect(phases.slice(0, 3).map((p) => p.status)).toEqual([
        'missing',
        'missing',
        'missing',
      ]);
    });
  });

  describe('unknown phases', () => {
    it('appends unknown Start/End pairs after the three known phases', () => {
      const { phases } = deriveStartupSummary([
        ...ALL_MARKS,
        mark('bridgelessInitialMountStart', 950),
        mark('bridgelessInitialMountEnd', 1050),
      ]);
      expect(phases).toHaveLength(4);
      expect(phases[3]).toMatchObject({
        name: 'bridgelessInitialMount',
        status: 'complete',
        duration: 100,
      });
    });

    it('marks an unknown phase in-progress when only Start arrived', () => {
      const { phases } = deriveStartupSummary([
        mark('customPhaseStart', 200),
      ]);
      const custom = phases.find((p) => p.name === 'customPhase')!;
      expect(custom.status).toBe('in-progress');
    });
  });

  describe('total calculation', () => {
    it('uses nativeLaunchStart as the reference start', () => {
      const { total } = deriveStartupSummary(ALL_MARKS);
      // nativeLaunchStart=100, initialMountEnd=900 → 800
      expect(total.duration).toBe(800);
    });

    it('uses the last complete phase end when initialMount is missing', () => {
      const { total } = deriveStartupSummary([
        mark('nativeLaunchStart', 100),
        mark('nativeLaunchEnd', 300),
        mark('runJSBundleStart', 300),
        mark('runJSBundleEnd', 600),
        // initialMount absent
      ]);
      // nativeLaunchStart=100, runJSBundleEnd=600 → 500
      expect(total).toMatchObject({ status: 'complete', duration: 500 });
    });
  });

  describe('out-of-order marks', () => {
    it('pairs correctly regardless of mark order in the input', () => {
      const { phases } = deriveStartupSummary([
        mark('nativeLaunchEnd', 300),
        mark('runJSBundleEnd', 600),
        mark('initialMountEnd', 900),
        mark('nativeLaunchStart', 100),
        mark('runJSBundleStart', 300),
        mark('initialMountStart', 600),
      ]);
      expect(phases[0]).toMatchObject({ name: 'nativeLaunch', status: 'complete', duration: 200 });
      expect(phases[1]).toMatchObject({ name: 'runJSBundle', status: 'complete', duration: 300 });
      expect(phases[2]).toMatchObject({ name: 'initialMount', status: 'complete', duration: 300 });
    });
  });
});