import { describe, expect, it } from 'vitest';
import { createReactDevToolsBridge } from '../react-devtools-bridge.js';

describe('react devtools bridge', () => {
  it('requests profiling data only after a confirmed stop status', async () => {
    const sent: Array<{ event: string; payload: unknown }> = [];
    const bridge = await createReactDevToolsBridge({
      sendMessage: (message) => {
        sent.push(message);
      },
    });

    bridge.ingest({
      event: 'rendererAttached',
      payload: { id: 7 },
    });

    bridge.startProfiling();
    bridge.ingest({
      event: 'profilingStatus',
      payload: true,
    });
    bridge.ingest({
      event: 'operations',
      payload: [7, 1, 0],
    });

    bridge.stopProfiling();
    expect(sent.map((message) => message.event)).toEqual([
      'startProfiling',
      'stopProfiling',
    ]);

    bridge.ingest({
      event: 'profilingStatus',
      payload: false,
    });

    expect(sent.map((message) => message.event)).toEqual([
      'startProfiling',
      'stopProfiling',
      'getProfilingData',
    ]);
    expect(sent[2]).toEqual({
      event: 'getProfilingData',
      payload: { rendererID: 7 },
    });
  });
});
