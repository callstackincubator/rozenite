import type { SerializedPerformanceReactNativeMark } from '../shared/types';

export type StartupPhaseStatus = 'complete' | 'in-progress' | 'missing';

export type StartupPhase = {
  name: string;
  label: string;
  status: StartupPhaseStatus;
  startTime?: number;
  duration?: number;
};

export type StartupTotal = {
  status: StartupPhaseStatus;
  duration?: number;
};

export type StartupSummary = {
  phases: StartupPhase[];
  total: StartupTotal;
};

const KNOWN_PHASES: { name: string; label: string }[] = [
  { name: 'nativeLaunch', label: 'Native Launch' },
  { name: 'runJSBundle', label: 'JS Bundle' },
  { name: 'initialMount', label: 'Initial Mount' },
];

export const deriveStartupSummary = (
  marks: SerializedPerformanceReactNativeMark[],
): StartupSummary => {
  const starts = new Map<string, number>();
  const ends = new Map<string, number>();

  for (const mark of marks) {
    if (mark.name.endsWith('Start')) {
      starts.set(mark.name.slice(0, -'Start'.length), mark.startTime);
    } else if (mark.name.endsWith('End')) {
      ends.set(mark.name.slice(0, -'End'.length), mark.startTime);
    }
  }

  const knownNames = new Set(KNOWN_PHASES.map((p) => p.name));

  const buildPhase = (name: string, label: string): StartupPhase => {
    const startTime = starts.get(name);
    const endTime = ends.get(name);
    if (startTime === undefined && endTime === undefined) {
      return { name, label, status: 'missing' };
    }
    if (endTime === undefined) {
      return { name, label, status: 'in-progress', startTime };
    }
    return {
      name,
      label,
      status: 'complete',
      startTime,
      duration: endTime - (startTime ?? endTime),
    };
  };

  const knownPhases = KNOWN_PHASES.map(({ name, label }) =>
    buildPhase(name, label),
  );

  const unknownPhases: StartupPhase[] = [];
  for (const [name] of starts) {
    if (!knownNames.has(name)) {
      unknownPhases.push(buildPhase(name, name));
    }
  }
  // unknown phases that only have an End mark (no Start)
  for (const [name] of ends) {
    if (!knownNames.has(name) && !starts.has(name)) {
      unknownPhases.push(buildPhase(name, name));
    }
  }

  const phases = [...knownPhases, ...unknownPhases];

  // Total: nativeLaunchStart → the endTime of the last complete known phase,
  // falling back to the last complete unknown phase.
  const totalStart = starts.get('nativeLaunch');
  const completePhases = phases.filter((p) => p.status === 'complete');
  const lastComplete = completePhases[completePhases.length - 1];

  let total: StartupTotal;
  if (totalStart === undefined) {
    total = { status: 'missing' };
  } else if (lastComplete) {
    const lastEndTime = lastComplete.startTime! + lastComplete.duration!;
    total = { status: 'complete', duration: lastEndTime - totalStart };
  } else {
    total = { status: 'in-progress' };
  }

  return { phases, total };
};
