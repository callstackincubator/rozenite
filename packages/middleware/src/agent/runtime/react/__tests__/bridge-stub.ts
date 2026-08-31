import type { ReactDevToolsBridge, ReactProfilingStatus } from '../react-devtools-bridge.js';
import type {
  ReactChangeDescription,
  ReactCommitData,
  ReactProfilingSnapshot,
  ReactRootProfilingData,
} from '../profiling-store.js';

export const createChangeDescription = (
  overrides: Partial<ReactChangeDescription> = {},
): ReactChangeDescription => ({
  context: null,
  didHooksChange: false,
  isFirstMount: false,
  props: null,
  state: null,
  ...overrides,
});

/**
 * One commit as the profiling store would hold it, so a test can state only the
 * fields it is about and still satisfy the bridge contract.
 */
export const createCommit = (overrides: Partial<ReactCommitData> = {}): ReactCommitData => ({
  changeDescriptions: null,
  duration: 0,
  effectDuration: null,
  fiberActualDurations: new Map(),
  fiberSelfDurations: new Map(),
  passiveEffectDuration: null,
  priorityLevel: null,
  timestamp: 0,
  updaters: null,
  ...overrides,
});

export const createProfilingSnapshot = (
  overrides: Partial<ReactProfilingSnapshot> = {},
): ReactProfilingSnapshot => ({
  phase: 'complete',
  dataForRoots: new Map<number, ReactRootProfilingData>(),
  rendererIdByRootId: new Map(),
  participatingRendererIds: new Set([1]),
  pendingRendererIds: new Set(),
  receivedRendererIds: new Set([1]),
  conflictingRootIds: new Set(),
  ...overrides,
});

export const createProfilingStatus = (
  overrides: Partial<ReactProfilingStatus> = {},
): ReactProfilingStatus => ({
  supportsProfiling: true,
  supportsReloadAndProfile: false,
  isProfilingStarted: false,
  isProcessingData: false,
  hasProfilingData: false,
  rootsWithData: 0,
  rootsCount: 0,
  ...overrides,
});

export const createBridgeStub = (
  overrides: Partial<ReactDevToolsBridge> = {},
): ReactDevToolsBridge => ({
  ingest: () => null,
  send: () => undefined,
  startProfiling: () => undefined,
  stopProfiling: () => undefined,
  reloadAndProfile: () => undefined,
  getProfilingStatus: () => createProfilingStatus(),
  getProfilingDataSnapshot: () => createProfilingSnapshot(),
  getCommitData: () => {
    throw new Error('No commit data');
  },
  ...overrides,
});

/**
 * A bridge whose profiling data is one snapshot, with `getCommitData` served
 * from that same snapshot so per-commit and whole-session reads cannot drift.
 */
export const createProfilingBridgeStub = (
  dataForRoots: Map<number, ReactRootProfilingData>,
  snapshotOverrides: Partial<ReactProfilingSnapshot> = {},
): ReactDevToolsBridge => {
  const snapshot = createProfilingSnapshot({ dataForRoots, ...snapshotOverrides });

  return createBridgeStub({
    getProfilingStatus: () =>
      createProfilingStatus({
        hasProfilingData: dataForRoots.size > 0,
        rootsWithData: dataForRoots.size,
        rootsCount: dataForRoots.size,
      }),
    getProfilingDataSnapshot: () => snapshot,
    getCommitData: (rootId, commitIndex) => {
      const commit = dataForRoots.get(rootId)?.commitData[commitIndex];
      if (!commit) {
        throw new Error(
          `Could not find commit data for root "${rootId}" and commit "${commitIndex}"`,
        );
      }
      return commit;
    },
  });
};
