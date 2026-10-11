import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentSessionInfo } from '@rozenite/agent-shared';
import { resolveAgentSession, waitForToolsToSettle } from '../commands/agent/session-resolution.js';

const sessionInfo = (toolCount: number): AgentSessionInfo => ({
  id: 'device-1-1',
  host: '127.0.0.1',
  port: 8081,
  deviceId: 'device-1',
  deviceName: 'iPhone',
  appId: 'app',
  pageId: '1',
  status: 'connected',
  createdAt: 1,
  lastActivityAt: 1,
  toolCount,
});

const fakeTransport = (toolCounts: number[]) => {
  const reads = [...toolCounts];
  return {
    getSession: vi.fn(async () => ({
      session: sessionInfo(reads.length > 1 ? reads.shift()! : reads[0]!),
    })),
    createSession: vi.fn(),
    listTargets: vi.fn(),
  };
};

describe('waitForToolsToSettle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps polling while the tool count is still growing, then stops once it is stable', async () => {
    const transport = fakeTransport([9, 12, 12, 12]);

    await waitForToolsToSettle(transport, 'device-1-1', 5, { intervalMs: 1, stableReads: 3 });

    // 5 → 9 → 12 → 12 → 12: the last three reads agree.
    expect(transport.getSession).toHaveBeenCalledTimes(4);
  });

  it('returns at once when the count never changes', async () => {
    const transport = fakeTransport([5]);

    await waitForToolsToSettle(transport, 'device-1-1', 5, { intervalMs: 1, stableReads: 3 });

    expect(transport.getSession).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxWaitMs when the count keeps changing', async () => {
    // Advance the clock per read so the deadline does not depend on CI speed.
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 10));
    let count = 0;
    const transport = {
      getSession: vi.fn(async () => ({ session: sessionInfo((count += 1)) })),
    };

    await waitForToolsToSettle(transport, 'device-1-1', 0, {
      intervalMs: 1,
      stableReads: 3,
      maxWaitMs: 30,
    });

    expect(transport.getSession.mock.calls.length).toBeGreaterThan(1);
    expect(transport.getSession.mock.calls.length).toBeLessThan(10);
  });

  it('swallows a failed read so the command reports the real error itself', async () => {
    const transport = {
      getSession: vi.fn(async () => {
        throw new Error('gone');
      }),
    };

    await expect(
      waitForToolsToSettle(transport, 'device-1-1', 0, { intervalMs: 1 }),
    ).resolves.toBeUndefined();
  });
});

describe('resolveAgentSession settle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('waits for tools only when the server says it created the session', async () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const created = fakeTransport([5, 12, 12, 12]);
    created.createSession.mockResolvedValue({ session: sessionInfo(5), created: true });

    await resolveAgentSession(created, {}, {}, { intervalMs: 1, stableReads: 3 });
    expect(created.getSession).toHaveBeenCalled();

    const reused = fakeTransport([12]);
    reused.createSession.mockResolvedValue({ session: sessionInfo(12), created: false });

    await resolveAgentSession(reused, {}, {}, { intervalMs: 1, stableReads: 3 });
    expect(reused.getSession).not.toHaveBeenCalled();
  });
});
