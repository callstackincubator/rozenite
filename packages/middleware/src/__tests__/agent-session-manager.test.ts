import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AGENT_INFO_ROUTE,
  AGENT_SESSIONS_ROUTE,
  AGENT_TARGETS_ROUTE,
  DEFAULT_AGENT_HOST,
  DEFAULT_AGENT_PORT,
  getAgentSessionCallToolRoute,
  getAgentSessionRoute,
  getAgentSessionToolsRoute,
} from '@rozenite/agent-shared';
import { createAgentSessionManager } from '../agent/session-manager.js';

const mocks = vi.hoisted(() => {
  const getMetroTargets = vi.fn();
  const resolveMetroTarget = vi.fn();
  const start = vi.fn();
  const stop = vi.fn();
  const getInfo = vi.fn();
  const getTools = vi.fn();
  const callTool = vi.fn();
  const createAgentSession = vi.fn(() => ({
    id: 'device-1',
    start,
    stop,
    getInfo,
    getTools,
    callTool,
  }));

  return {
    getMetroTargets,
    resolveMetroTarget,
    start,
    stop,
    getInfo,
    getTools,
    callTool,
    createAgentSession,
  };
});

vi.mock('../agent/metro-discovery.js', () => ({
  getMetroTargets: mocks.getMetroTargets,
  resolveMetroTarget: mocks.resolveMetroTarget,
}));

vi.mock('../agent/session.js', () => ({
  createAgentSession: mocks.createAgentSession,
}));

describe('agent session manager', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mocks.start.mockReset();
    mocks.start.mockResolvedValue(undefined);
  });

  const target = {
    id: 'device-1',
    name: 'Phone',
    appId: 'app.test',
    pageId: 'page-1',
    title: 'App',
    description: 'desc',
    webSocketDebuggerUrl: 'ws://localhost:8081/debug',
  };

  it('exposes shared route constants', () => {
    expect(AGENT_INFO_ROUTE).toBe('/rozenite/agent/info');
    expect(AGENT_TARGETS_ROUTE).toBe('/rozenite/agent/targets');
    expect(AGENT_SESSIONS_ROUTE).toBe('/rozenite/agent/sessions');
    expect(getAgentSessionRoute('device-1')).toBe(
      '/rozenite/agent/sessions/device-1',
    );
    expect(getAgentSessionToolsRoute('device-1')).toBe(
      '/rozenite/agent/sessions/device-1/tools',
    );
    expect(getAgentSessionCallToolRoute('device-1')).toBe(
      '/rozenite/agent/sessions/device-1/call-tool',
    );
  });

  it('uses default localhost Metro endpoint', () => {
    const manager = createAgentSessionManager({ projectRoot: '/app' });

    expect(manager.getInfo()).toEqual({
      host: DEFAULT_AGENT_HOST,
      port: DEFAULT_AGENT_PORT,
      projectRoot: '/app',
      sessionCount: 0,
    });
  });

  it('lists targets through Metro discovery', async () => {
    mocks.getMetroTargets.mockResolvedValue([
      { id: 'device-1', name: 'Phone' },
    ]);
    const manager = createAgentSessionManager({ projectRoot: '/app' });

    await expect(manager.listTargets()).resolves.toEqual([
      { id: 'device-1', name: 'Phone' },
    ]);
    expect(mocks.getMetroTargets).toHaveBeenCalledWith('localhost', 8081);
  });

  it('creates and reuses the same session per device', async () => {
    mocks.resolveMetroTarget.mockResolvedValue(target);
    mocks.getInfo.mockReturnValue({ id: 'device-1', deviceName: 'Phone' });

    const manager = createAgentSessionManager({ projectRoot: '/app' });

    await expect(
      manager.createSession({ deviceId: 'device-1' }),
    ).resolves.toEqual({
      session: { id: 'device-1', deviceName: 'Phone' },
    });
    await expect(
      manager.createSession({ deviceId: 'device-1' }),
    ).resolves.toEqual({
      session: { id: 'device-1', deviceName: 'Phone' },
    });

    expect(mocks.createAgentSession).toHaveBeenCalledTimes(1);
    expect(mocks.start).toHaveBeenCalledTimes(1);
  });

  it('passes CLI and Metro versions into a new session', async () => {
    mocks.resolveMetroTarget.mockResolvedValue(target);
    mocks.getInfo.mockReturnValue({ id: 'device-1', deviceName: 'Phone' });

    const manager = createAgentSessionManager({
      projectRoot: '/app',
      metroVersion: '1.6.0',
    });

    await manager.createSession({
      deviceId: 'device-1',
      cliVersion: '1.5.0',
    });

    expect(mocks.createAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        target,
        cliVersion: '1.5.0',
        metroVersion: '1.6.0',
      }),
    );
  });

  it('returns a version warning only when CLI and Metro differ', async () => {
    mocks.resolveMetroTarget.mockResolvedValue(target);
    mocks.getInfo.mockReturnValue({ id: 'device-1', deviceName: 'Phone' });

    const manager = createAgentSessionManager({
      projectRoot: '/app',
      metroVersion: '1.6.0',
    });

    await expect(
      manager.createSession({ deviceId: 'device-1', cliVersion: '1.5.0' }),
    ).resolves.toEqual({
      session: { id: 'device-1', deviceName: 'Phone' },
      versionCheck:
        'Connected Rozenite agent uses version 1.5.0, but Metro is running version 1.6.0. Integration may not work correctly.',
    });
  });

  it('stops and removes sessions', async () => {
    mocks.resolveMetroTarget.mockResolvedValue(target);
    mocks.getInfo.mockReturnValue({ id: 'device-1', deviceName: 'Phone' });

    const manager = createAgentSessionManager({ projectRoot: '/app' });
    await manager.createSession({ deviceId: 'device-1' });

    await expect(manager.stopSession('device-1')).resolves.toEqual({
      stopped: true,
    });
    expect(manager.listSessions()).toEqual([]);
  });

  it('lists and calls tools via the session instance', async () => {
    mocks.resolveMetroTarget.mockResolvedValue(target);
    mocks.getInfo.mockReturnValue({ id: 'device-1', deviceName: 'Phone' });
    mocks.getTools.mockReturnValue([{ name: 'startTrace' }]);
    mocks.callTool.mockResolvedValue({ ok: true });

    const manager = createAgentSessionManager({ projectRoot: '/app' });
    await manager.createSession({ deviceId: 'device-1' });

    expect(manager.getSessionTools('device-1')).toEqual([
      { name: 'startTrace' },
    ]);
    await expect(
      manager.callSessionTool('device-1', 'startTrace', {}),
    ).resolves.toEqual({ ok: true });
  });

  it('waits for session startup before resolving createSession', async () => {
    mocks.resolveMetroTarget.mockResolvedValue(target);
    mocks.getInfo.mockReturnValue({ id: 'device-1', deviceName: 'Phone' });

    let resolveStart: (() => void) | undefined;
    mocks.start.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStart = resolve;
        }),
    );

    const manager = createAgentSessionManager({ projectRoot: '/app' });
    const createPromise = manager.createSession({ deviceId: 'device-1' });
    const onResolved = vi.fn();
    createPromise.then(onResolved);

    await Promise.resolve();
    expect(onResolved).not.toHaveBeenCalled();
    expect(manager.listSessions()).toEqual([]);

    resolveStart?.();

    await expect(createPromise).resolves.toEqual({
      session: {
        id: 'device-1',
        deviceName: 'Phone',
      },
    });
  });

  it('lists the session after createSession resolves', async () => {
    mocks.resolveMetroTarget.mockResolvedValue(target);
    const sessionInfo = { id: 'device-1', deviceName: 'Phone' };
    mocks.getInfo.mockReturnValue(sessionInfo);

    const manager = createAgentSessionManager({ projectRoot: '/app' });

    await manager.createSession({ deviceId: 'device-1' });

    expect(manager.listSessions()).toEqual([sessionInfo]);
  });

  it('syncs host and port overrides', () => {
    const manager = createAgentSessionManager({ projectRoot: '/app' });
    manager.syncEndpoint('10.0.0.5', 9090);

    expect(manager.getInfo()).toEqual({
      host: '10.0.0.5',
      port: 9090,
      projectRoot: '/app',
      sessionCount: 0,
    });
  });
});
