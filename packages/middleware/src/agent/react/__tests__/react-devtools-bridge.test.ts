import { describe, expect, it, vi } from 'vitest';
import { createReactDevToolsBridge } from '../react-devtools-bridge.js';

describe('createReactDevToolsBridge', () => {
  it('requests profiling data for each known renderer after stop profiling', async () => {
    const sendMessage = vi.fn();
    const bridge = await createReactDevToolsBridge({ sendMessage });

    bridge.ingest({
      event: 'renderer',
      payload: { id: 1 },
    });
    bridge.ingest({
      event: 'rendererAttached',
      payload: { id: 2 },
    });

    bridge.stopProfiling();

    expect(sendMessage).toHaveBeenNthCalledWith(1, {
      event: 'stopProfiling',
      payload: undefined,
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      event: 'getProfilingData',
      payload: { rendererID: 1 },
    });
    expect(sendMessage).toHaveBeenNthCalledWith(3, {
      event: 'getProfilingData',
      payload: { rendererID: 2 },
    });
  });

  it('learns renderer id from operations and requests profiling data on stop', async () => {
    const sendMessage = vi.fn();
    const bridge = await createReactDevToolsBridge({ sendMessage });

    bridge.ingest({
      event: 'operations',
      payload: [7, 1, 0],
    });

    bridge.stopProfiling();

    expect(sendMessage).toHaveBeenNthCalledWith(1, {
      event: 'stopProfiling',
      payload: undefined,
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      event: 'getProfilingData',
      payload: { rendererID: 7 },
    });
  });
});
