import { describe, expect, it } from 'vitest';
import type { ProcessedRequest } from '../../state/model';
import {
  formatTimelineOffset,
  getTimelineModel,
  getTimelineTicks,
  isRequestActive,
  TIMELINE_LAYOUT,
} from '../timelineModel';

const createRequest = (
  overrides: Partial<ProcessedRequest> = {},
): ProcessedRequest => ({
  id: 'request-1',
  type: 'http',
  name: 'https://example.com/api',
  status: 'finished',
  timestamp: 0,
  duration: 100,
  size: null,
  method: 'GET',
  ...overrides,
});

describe('timelineModel', () => {
  it('formats minute offsets without rolling seconds up to 60', () => {
    expect(formatTimelineOffset(119_900)).toBe('2m 00s');
  });

  it('treats websocket closing state as active', () => {
    expect(
      isRequestActive(
        createRequest({
          type: 'websocket',
          status: 'closing',
          method: 'WS',
        }),
      ),
    ).toBe(true);
  });

  it('uses the earliest ending lane when all lanes are occupied', () => {
    const requests = Array.from(
      { length: TIMELINE_LAYOUT.laneCount },
      (_, index) =>
        createRequest({
          id: `request-${index}`,
          timestamp: 0,
          duration: index === 1 ? 100 : 1000,
        }),
    );

    const overflowingRequest = createRequest({
      id: 'overflowing-request',
      timestamp: 50,
      duration: 200,
    });

    const model = getTimelineModel([...requests, overflowingRequest], 0);
    const overflowingRow = model.rows.find(
      (row) => row.request.id === overflowingRequest.id,
    );

    expect(overflowingRow?.lane).toBe(1);
    expect(overflowingRow?.isOverflowingLane).toBe(true);
  });

  it('keeps long-session tick counts near the target count', () => {
    const oneHour = 60 * 60 * 1000;
    const model = getTimelineModel(
      [
        createRequest({
          duration: oneHour,
        }),
      ],
      0,
    );

    expect(model.ticks.length).toBeLessThanOrEqual(
      TIMELINE_LAYOUT.tickTargetCount + 2,
    );
  });

  it('does not add a duplicate final tick label', () => {
    const ticks = getTimelineTicks(1548, {
      ...TIMELINE_LAYOUT,
      tickTargetCount: 7,
    });

    expect(ticks.map((tick) => tick.label)).toEqual([
      '0 ms',
      '250 ms',
      '500 ms',
      '750 ms',
      '1.0 s',
      '1.3 s',
      '1.5 s',
    ]);
  });

  it('caps rendered rows for large recordings', () => {
    const maxRenderedRequests = 3;
    const model = getTimelineModel(
      Array.from({ length: 5 }, (_, index) =>
        createRequest({
          id: `request-${index}`,
          timestamp: index,
        }),
      ),
      0,
      {
        ...TIMELINE_LAYOUT,
        maxRenderedRequests,
      },
    );

    expect(model.rows.map((row) => row.request.id)).toEqual([
      'request-2',
      'request-3',
      'request-4',
    ]);
    expect(model.totalRequestCount).toBe(5);
    expect(model.hiddenRequestCount).toBe(2);
  });
});
