import type {
  SerializedPerformanceMeasure,
  SerializedPerformanceReactNativeMark,
} from '../shared/types';

// UI-only marker. Never flows over the wire — `SerializedPerformanceMeasure`
// in shared/types stays the device-emitted contract; this is purely
// produced and consumed in the panel.
export type DerivedMeasure = SerializedPerformanceMeasure & {
  derivedFromReactNativeMark: true;
};

// React Native emits its startup taxonomy as paired Start/End marks
// (nativeLaunchStart/End, runJSBundleStart/End, initialMountStart/End, ...).
// Pair them up into measures so the Measures tab shows the durations
// directly instead of forcing the user to subtract two marks by hand.
//
// Anything without a matching partner is left for the React Native Marks
// tab to render as-is (e.g. `appStartup` is single-point in some RN
// versions; user-defined RN marks that happen to share the suffix
// convention won't synthesize a stray measure here either).
export const deriveStartupPhases = (
  marks: SerializedPerformanceReactNativeMark[],
): DerivedMeasure[] => {
  const starts = new Map<string, SerializedPerformanceReactNativeMark>();
  const result: DerivedMeasure[] = [];

  for (const mark of marks) {
    if (mark.name.endsWith('Start')) {
      starts.set(mark.name.slice(0, -'Start'.length), mark);
      continue;
    }
    if (mark.name.endsWith('End')) {
      const base = mark.name.slice(0, -'End'.length);
      const start = starts.get(base);
      if (!start) continue;
      result.push({
        name: base,
        startTime: start.startTime,
        duration: mark.startTime - start.startTime,
        entryType: 'measure',
        detail: start.detail,
        derivedFromReactNativeMark: true,
      });
    }
  }
  return result;
};
