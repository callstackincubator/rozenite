import { describe, expect, it } from 'vitest';
import { collapseProgressEvents, createNormaliser } from './normalise';

const fixtureBaseUrl = 'http://localhost:38383';

describe('createNormaliser', () => {
  it('tokenises ids consistently and replaces clocks, keeping the rest verbatim', () => {
    const normalise = createNormaliser({ fixtureBaseUrl });
    const events = [
      {
        type: 'request-sent',
        payload: {
          requestId: 'req_1_abc',
          timestamp: 1700000000000,
          type: 'XHR',
          source: 'builtin',
          request: {
            url: `${fixtureBaseUrl}/json`,
            method: 'GET',
            headers: { 'x-rozenite-scenario': 'fetch-get-json' },
          },
          initiator: {
            type: 'script',
            generatedUrl: 'http://localhost:8081/index.bundle?platform=ios&dev=true',
            generatedLineNumber: 1234,
            generatedColumnNumber: 56,
            stack: [{ functionName: 'run', generatedLineNumber: 1, generatedColumnNumber: 2 }],
          },
        },
      },
      {
        type: 'response-received',
        payload: {
          requestId: 'req_1_abc',
          response: {
            status: 200,
            size: 42,
            responseTime: 1700000000005,
            headers: { Date: 'Mon', 'Content-Length': '42', ETag: 'x', Connection: 'keep-alive' },
          },
        },
      },
      { type: 'request-completed', payload: { requestId: 'req_1_abc', duration: 5, ttfb: 3 } },
    ];

    expect(normalise(events)).toEqual([
      {
        type: 'request-sent',
        payload: {
          requestId: '<request-1>',
          timestamp: '<number>',
          type: 'XHR',
          source: 'builtin',
          request: {
            url: '<fixture>/json',
            method: 'GET',
            headers: { 'x-rozenite-scenario': 'fetch-get-json' },
          },
          initiator: {
            type: 'script',
            generatedUrl: 'http://localhost:8081/index.bundle?<query>',
            generatedLineNumber: '<number>',
            generatedColumnNumber: '<number>',
            stack: [
              {
                functionName: 'run',
                generatedLineNumber: '<number>',
                generatedColumnNumber: '<number>',
              },
            ],
          },
        },
      },
      {
        type: 'response-received',
        payload: {
          requestId: '<request-1>',
          response: {
            status: 200,
            size: 42,
            responseTime: '<number>',
            headers: { 'Content-Length': '42' },
          },
        },
      },
      {
        type: 'request-completed',
        payload: { requestId: '<request-1>', duration: '<number>', ttfb: '<number>' },
      },
    ]);
  });

  it('masks multipart boundaries, fixture WebSocket origins and long bodies', () => {
    const normalise = createNormaliser({ fixtureBaseUrl });
    const normalised = normalise({
      socketId: 'socket-9',
      url: 'ws://localhost:38383/ws?scenario=websocket-echo',
      contentType: 'multipart/form-data; boundary=abc123',
      body: 'x'.repeat(5000),
    }) as Record<string, string>;

    expect(normalised.socketId).toBe('<socket-1>');
    expect(normalised.url).toBe('<fixture-ws>/ws?scenario=websocket-echo');
    expect(normalised.contentType).toBe('multipart/form-data; boundary=<boundary>');
    expect(normalised.body).toMatch(/^<string length=5000 sha256=[0-9a-f]{16}>$/);
  });
});

describe('collapseProgressEvents', () => {
  it('keeps one progress entry per request, at the first position, with the final totals', () => {
    const progress = (loaded: number) => ({
      type: 'request-progress',
      payload: { requestId: 'r1', loaded, total: 30, lengthComputable: true, timestamp: loaded },
    });

    expect(
      collapseProgressEvents([
        { type: 'response-received', payload: { requestId: 'r1' } },
        progress(10),
        progress(20),
        progress(30),
        { type: 'request-completed', payload: { requestId: 'r1' } },
      ]),
    ).toEqual([
      { type: 'response-received', payload: { requestId: 'r1' } },
      {
        type: 'request-progress',
        payload: {
          requestId: 'r1',
          collapsedEvents: '<count>',
          loaded: 30,
          total: 30,
          lengthComputable: true,
        },
      },
      { type: 'request-completed', payload: { requestId: 'r1' } },
    ]);
  });
});
