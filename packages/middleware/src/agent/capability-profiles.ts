/**
 * Per-platform capability profiles for the built-in agent domains.
 *
 * Verified against `lynx-family/lynx` and `lynx-family/primjs` rather
 * than inferred: `LynxDevToolNG::RegisterAgents` is the list of CDP
 * domains a Lynx device answers at all, and `primjs`'s
 * `src/inspector/protocols.cc` is the method table behind the four
 * domains (`Runtime`, `Debugger`, `Profiler`, `HeapProfiler`) that Lynx
 * forwards straight into the JS engine.
 *
 * Deliberately a static table rather than a runtime probe. A probe costs
 * round trips at session start and cannot see the failure that matters
 * most anyway: PrimJS answers an unknown method with an empty success,
 * which is indistinguishable from a real one. The single axis that
 * genuinely varies at runtime is the V8-vs-PrimJS backend, and that
 * already has a free signal — only V8 ever emits a real
 * `Runtime.executionContextCreated` (see
 * `@rozenite/lynx-dev`'s `translate-device-frame.ts`). Leave that as a
 * future refinement; do not build the table on it.
 */
import {
  createEmptyCapabilityProfile,
  type AgentTargetPlatform,
  type CapabilityProfile,
} from '@rozenite/agent-shared';

const HEAP_SAMPLING_REASON =
  'Lynx forwards HeapProfiler to the JS engine, and PrimJS implements only ' +
  'takeHeapSnapshot. It answers methods it does not know with an empty success, so ' +
  'sampling would appear to start and then collect nothing.';

/**
 * React Native is the platform every built-in domain was written
 * against, so it declares no gaps and every lookup short-circuits to
 * "supported".
 */
const REACT_NATIVE_PROFILE: CapabilityProfile = createEmptyCapabilityProfile('react-native');

const LYNX_PROFILE: CapabilityProfile = {
  platform: 'lynx',
  domains: {
    network: {
      availability: 'unsupported',
      reason:
        'Lynx registers no CDP Network domain, so every Network.* command returns ' +
        '"Not implemented" (-32601).',
      fallback: '@rozenite/network-activity-plugin',
    },
    react: {
      availability: 'unsupported',
      reason:
        'Lynx has no React DevTools backend, and @rozenite/lynx only initialises the ' +
        '"rozenite" dispatcher domain, so react-devtools messages are never delivered.',
    },
    performance: {
      availability: 'unsupported',
      reason:
        'Lynx implements a Perfetto-based Tracing domain: it ignores Chrome trace ' +
        'categories and returns the result as an IO stream handle, never as ' +
        'Tracing.dataCollected events.',
    },
    memory: {
      // The domain stays usable — heap snapshots work on Lynx, and they
      // are the reason to reach for this domain in the first place.
      availability: 'degraded',
      tools: {
        takeHeapSnapshot: { availability: 'supported' },
        startSampling: { availability: 'unsupported', reason: HEAP_SAMPLING_REASON },
        stopSampling: { availability: 'unsupported', reason: HEAP_SAMPLING_REASON },
      },
    },
    // `console` has no entry: PrimJS emits Runtime.consoleAPICalled and
    // Lynx's own Log agent emits Log.entryAdded, which is everything the
    // console domain passively captures.
  },
};

export const resolveCapabilityProfile = (platform: AgentTargetPlatform): CapabilityProfile => {
  return platform === 'lynx' ? LYNX_PROFILE : REACT_NATIVE_PROFILE;
};

export { LYNX_PROFILE, REACT_NATIVE_PROFILE };
