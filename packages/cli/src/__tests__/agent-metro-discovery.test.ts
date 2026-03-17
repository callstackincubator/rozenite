import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const mocks = vi.hoisted(() => ({
  requestImpl: vi.fn(),
}));

vi.mock('node:http', () => ({
  request: mocks.requestImpl,
}));

describe('agent metro discovery', () => {
  it('wraps Metro connection failures with a clear message', async () => {
    mocks.requestImpl.mockImplementation(() => {
      const req = new EventEmitter() as EventEmitter & { end: () => void; once: typeof EventEmitter.prototype.once };
      req.end = () => {
        req.emit('error', new AggregateError([
          new Error('connect ECONNREFUSED 127.0.0.1:8081'),
        ], ''));
      };
      return req;
    });

    const { getMetroTargets } = await import('../commands/agent/metro-discovery.js');

    await expect(getMetroTargets('127.0.0.1', 8081)).rejects.toThrow(
      'Unable to reach Metro at http://127.0.0.1:8081. Make sure Metro is running and reachable, then try again. Details: connect ECONNREFUSED 127.0.0.1:8081',
    );
  });
});
