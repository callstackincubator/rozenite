import { describe, expect, it } from 'vitest';
import { createProfilingStore } from '../profiling-store.js';

describe('createProfilingStore', () => {
  it('tracks profiling status transitions', () => {
    const store = createProfilingStore();

    store.ingestProfilingStatus({
      supportsProfiling: true,
      supportsReloadAndProfile: true,
      isProfilingStarted: false,
      isProcessingData: false,
    });

    store.startProfiling();
    let status = store.getStatus(1);
    expect(status).toMatchObject({
      supportsProfiling: true,
      supportsReloadAndProfile: true,
      isProfilingStarted: true,
      isProcessingData: false,
    });

    store.stopProfiling();
    status = store.getStatus(1);
    expect(status.isProfilingStarted).toBe(false);
    expect(status.isProcessingData).toBe(true);
  });

  it('normalizes map-based profiling payloads and reads commit data', () => {
    const store = createProfilingStore();

    store.ingestProfilingData({
      dataForRoots: new Map([
        [5, {
          commitData: [{
            changeDescriptions: new Map([
              [101, {
                context: null,
                didHooksChange: true,
                isFirstMount: false,
                props: ['value'],
                state: null,
              }],
            ]),
            duration: 18,
            effectDuration: 1,
            fiberActualDurations: new Map([[101, 12]]),
            fiberSelfDurations: new Map([[101, 8]]),
            passiveEffectDuration: 0,
            priorityLevel: 'Normal',
            timestamp: 222,
            updaters: [{ id: 101 }],
          }],
        }],
      ]),
    });

    const snapshot = store.getSnapshot();
    expect(snapshot.dataForRoots.size).toBe(1);

    const commit = store.getCommitData(5, 0);
    expect(commit.duration).toBe(18);
    expect(commit.fiberActualDurations.get(101)).toBe(12);
    expect(commit.changeDescriptions?.get(101)?.didHooksChange).toBe(true);
  });

  it('throws for missing commit data', () => {
    const store = createProfilingStore();

    expect(() => store.getCommitData(999, 0)).toThrow(
      'Could not find commit data for root "999" and commit "0"',
    );
  });
});
