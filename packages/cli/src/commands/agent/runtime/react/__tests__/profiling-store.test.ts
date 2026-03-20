import { describe, expect, it } from 'vitest';
import {
  createProfilingStore,
  normalizeProfilingDataEvent,
} from '../profiling-store.js';

describe('profiling store', () => {
  it('waits for all participating renderers before completing processing', () => {
    const store = createProfilingStore();

    store.registerRenderer(1);
    store.registerRenderer(2);
    store.requestProfilingStart();
    store.ingestProfilingStatus({ isProfiling: true });
    store.noteProfilingOperation(1);
    store.noteProfilingOperation(2);

    const stopUpdate = store.ingestProfilingStatus({ isProfiling: false });
    expect(stopUpdate.requestProfilingDataForRendererIds).toEqual([1, 2]);
    expect(store.getStatus(1).isProcessingData).toBe(true);

    expect(store.ingestProfilingData(normalizeProfilingDataEvent({
      rendererID: 1,
      dataForRoots: [{
        rootID: 10,
        commitData: [{
          duration: 12,
          timestamp: 100,
          fiberActualDurations: [[10, 12]],
          fiberSelfDurations: [[10, 4]],
        }],
      }],
    }))).toBe(true);
    expect(store.getStatus(1).isProcessingData).toBe(true);

    expect(store.ingestProfilingData(normalizeProfilingDataEvent({
      rendererID: 2,
      dataForRoots: [{
        rootID: 11,
        commitData: [{
          duration: 8,
          timestamp: 120,
          fiberActualDurations: [[11, 8]],
          fiberSelfDurations: [[11, 3]],
        }],
      }],
    }))).toBe(true);

    const status = store.getStatus(2);
    expect(status.isProcessingData).toBe(false);
    expect(status.hasProfilingData).toBe(true);
    expect(status.rootsWithData).toBe(2);
  });

  it('ignores profiling payloads from renderers that were not requested', () => {
    const store = createProfilingStore();

    store.registerRenderer(7);
    store.requestProfilingStart();
    store.ingestProfilingStatus({ isProfiling: true });
    store.noteProfilingOperation(7);
    store.ingestProfilingStatus({ isProfiling: false });

    expect(store.ingestProfilingData(normalizeProfilingDataEvent({
      rendererID: 8,
      dataForRoots: [{
        rootID: 1,
        commitData: [{
          duration: 15,
          timestamp: 10,
          fiberActualDurations: [[1, 15]],
          fiberSelfDurations: [[1, 7]],
        }],
      }],
    }))).toBe(false);

    const snapshot = store.getSnapshot();
    expect(snapshot.pendingRendererIds).toEqual(new Set([7]));
    expect(snapshot.dataForRoots.size).toBe(0);
  });

  it('accepts boolean profiling status payloads', () => {
    const store = createProfilingStore();

    store.requestProfilingStart();
    expect(store.getStatus(0).isProfilingStarted).toBe(true);
    store.ingestProfilingStatus({ isProfiling: true });
    expect(store.getStatus(0).isProfilingStarted).toBe(true);

    store.ingestProfilingStatus({ isProfiling: false });
    expect(store.getStatus(0).isProfilingStarted).toBe(false);
  });

  it('does not merge duplicate root ids from different renderers', () => {
    const store = createProfilingStore();

    store.registerRenderer(1);
    store.registerRenderer(2);
    store.requestProfilingStart();
    store.ingestProfilingStatus({ isProfiling: true });
    store.noteProfilingOperation(1);
    store.noteProfilingOperation(2);
    store.ingestProfilingStatus({ isProfiling: false });

    expect(store.ingestProfilingData(normalizeProfilingDataEvent({
      rendererID: 1,
      dataForRoots: [{
        rootID: 10,
        commitData: [{
          duration: 12,
          timestamp: 100,
          fiberActualDurations: [[10, 12]],
          fiberSelfDurations: [[10, 4]],
        }],
      }],
    }))).toBe(true);

    expect(store.ingestProfilingData(normalizeProfilingDataEvent({
      rendererID: 2,
      dataForRoots: [{
        rootID: 10,
        commitData: [{
          duration: 18,
          timestamp: 120,
          fiberActualDurations: [[10, 18]],
          fiberSelfDurations: [[10, 5]],
        }],
      }],
    }))).toBe(true);

    const snapshot = store.getSnapshot();
    expect(snapshot.conflictingRootIds).toEqual(new Set([10]));
    expect(() => store.getCommitData(10, 0)).toThrow(
      'Commit data for root "10" is ambiguous across multiple React renderers.',
    );
  });
});
