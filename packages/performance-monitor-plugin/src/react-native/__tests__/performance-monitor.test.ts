import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PerformanceMonitorDevToolsClient } from '../../shared/types';

const mocks = vi.hoisted(() => {
  const observe = vi.fn();
  const disconnect = vi.fn();
  const send = vi.fn();

  class MockPerformanceObserver {
    observe = observe;
    disconnect = disconnect;

    constructor(callback: unknown) {
      void callback;
    }
  }

  return {
    MockPerformanceObserver,
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    clearMetrics: vi.fn(),
    disconnect,
    now: vi.fn(() => 100),
    observe,
    send,
  };
});

vi.mock('react-native-performance', () => ({
  default: {
    clearMarks: mocks.clearMarks,
    clearMeasures: mocks.clearMeasures,
    clearMetrics: mocks.clearMetrics,
    now: mocks.now,
    timeOrigin: 0,
  },
  PerformanceObserver: mocks.MockPerformanceObserver,
}));

import { getPerformanceMonitor } from '../performance-monitor';

const getClient = () =>
  ({
    send: mocks.send,
  }) as unknown as PerformanceMonitorDevToolsClient;

describe('getPerformanceMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not replay buffered resource entries when a new session starts', () => {
    const monitor = getPerformanceMonitor(getClient());

    monitor.enable();

    expect(mocks.observe).toHaveBeenCalledWith({
      type: 'resource',
    });
    expect(mocks.observe).not.toHaveBeenCalledWith({
      type: 'resource',
      buffered: true,
    });
  });
});
