import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deleteStaleState,
  listRegisteredDaemons,
  pruneRegisteredDaemons,
  readMetadata,
  shutdownAllRegisteredDaemons,
  shutdownRunningDaemon,
} from '../commands/agent/daemon-client.js';
import { getAgentDaemonTransport, getAgentGlobalRegistryPath } from '../commands/agent/daemon-paths.js';
import type { DaemonInfo } from '../commands/agent/daemon-protocol.js';
import type { RegisteredDaemonInfo } from '../commands/agent/daemon-registry.js';

const tempRoots: string[] = [];
let tempHome: string | null = null;

const createWorkspace = (): string => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rozenite-daemon-client-'));
  tempRoots.push(workspace);
  return workspace;
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  if (tempHome) {
    fs.rmSync(tempHome, { recursive: true, force: true });
    tempHome = null;
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const setupHome = (): string => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'rozenite-daemon-client-home-'));
  vi.spyOn(os, 'homedir').mockReturnValue(tempHome);
  return tempHome;
};

const writeRegistry = (entries: RegisteredDaemonInfo[]) => {
  fs.writeFileSync(
    getAgentGlobalRegistryPath(),
    JSON.stringify({ daemons: entries }, null, 2),
    'utf8',
  );
};

describe('agent daemon client helpers', () => {
  it('reads transport-neutral daemon metadata', () => {
    const workspace = createWorkspace();
    const transport = getAgentDaemonTransport(workspace, 'linux');
    const metadata: DaemonInfo = {
      pid: 123,
      workspace,
      transportKind: transport.kind,
      address: transport.address,
      startedAt: 456,
      sessionCount: 2,
    };

    fs.writeFileSync(transport.metadataPath, JSON.stringify(metadata), 'utf8');

    expect(readMetadata(workspace)).toEqual(metadata);
  });

  it('removes only metadata for windows named pipes', () => {
    const workspace = createWorkspace();
    const transport = getAgentDaemonTransport(workspace, 'win32');
    const rmSyncSpy = vi.spyOn(fs, 'rmSync').mockImplementation(() => undefined);

    fs.writeFileSync(transport.metadataPath, '{}', 'utf8');
    deleteStaleState(workspace, transport);

    expect(rmSyncSpy).toHaveBeenCalledTimes(1);
    expect(rmSyncSpy).toHaveBeenCalledWith(transport.metadataPath, { force: true });
  });

  it('removes metadata and unix socket files for unix transports', () => {
    const workspace = createWorkspace();
    const transport = getAgentDaemonTransport(workspace, 'linux');
    const rmSyncSpy = vi.spyOn(fs, 'rmSync').mockImplementation(() => undefined);

    fs.writeFileSync(transport.metadataPath, '{}', 'utf8');
    deleteStaleState(workspace, transport);

    expect(rmSyncSpy).toHaveBeenCalledTimes(2);
    expect(rmSyncSpy).toHaveBeenNthCalledWith(1, transport.metadataPath, { force: true });
    expect(rmSyncSpy).toHaveBeenNthCalledWith(2, transport.address, { force: true });
  });

  it('waits for daemon exit after shutdown rpc completes', async () => {
    vi.useFakeTimers();
    const workspace = createWorkspace();
    const transport = getAgentDaemonTransport(workspace, 'linux');
    const metadata: DaemonInfo = {
      pid: 4321,
      workspace,
      transportKind: transport.kind,
      address: transport.address,
      startedAt: 456,
      sessionCount: 2,
    };

    fs.writeFileSync(transport.metadataPath, JSON.stringify(metadata), 'utf8');

    const createConnectionSpy = vi.spyOn(net, 'createConnection').mockImplementation(() => {
      const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
      const socket = {
        setEncoding: vi.fn(),
        once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          const set = handlers.get(event) ?? new Set();
          set.add(handler);
          handlers.set(event, set);
          return socket;
        }),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          const set = handlers.get(event) ?? new Set();
          set.add(handler);
          handlers.set(event, set);
          return socket;
        }),
        write: vi.fn(() => {
          handlers.get('data')?.forEach((handler) =>
            handler(
              `${JSON.stringify({
                id: '1',
                ok: true,
                result: { stopped: true, stoppedSessions: 2 },
              })}\n`,
            ),
          );
        }),
        end: vi.fn(),
        destroy: vi.fn(),
      };

      queueMicrotask(() => {
        handlers.get('connect')?.forEach((handler) => handler());
      });

      return socket as unknown as net.Socket;
    });

    const killSpy = vi.spyOn(process, 'kill');
    killSpy.mockImplementation(((pid: number, signal?: NodeJS.Signals | number) => {
        if (signal === 0 || signal === undefined) {
          if (pid === metadata.pid && killSpy.mock.calls.filter(([, sig]) => sig === 0).length > 2) {
            throw new Error('process exited');
          }
          return true;
        }
        return true;
      }) as typeof process.kill);

    const resultPromise = shutdownRunningDaemon(workspace);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({ stopped: true, stoppedSessions: 2 });
    expect(createConnectionSpy).toHaveBeenCalled();
    expect(killSpy).not.toHaveBeenCalledWith(metadata.pid, 'SIGTERM');
  });

  it('falls back to SIGTERM when rpc shutdown does not stop the daemon', async () => {
    vi.useFakeTimers();
    const workspace = createWorkspace();
    const transport = getAgentDaemonTransport(workspace, 'linux');
    const metadata: DaemonInfo = {
      pid: 9876,
      workspace,
      transportKind: transport.kind,
      address: transport.address,
      startedAt: 456,
      sessionCount: 1,
    };

    fs.writeFileSync(transport.metadataPath, JSON.stringify(metadata), 'utf8');

    vi.spyOn(net, 'createConnection').mockImplementation(() => {
      const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
      const socket = {
        setEncoding: vi.fn(),
        once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          const set = handlers.get(event) ?? new Set();
          set.add(handler);
          handlers.set(event, set);
          return socket;
        }),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          const set = handlers.get(event) ?? new Set();
          set.add(handler);
          handlers.set(event, set);
          return socket;
        }),
        write: vi.fn(() => {
          handlers.get('data')?.forEach((handler) =>
            handler(
              `${JSON.stringify({
                id: '1',
                ok: true,
                result: { stopped: true, stoppedSessions: 1 },
              })}\n`,
            ),
          );
        }),
        end: vi.fn(),
        destroy: vi.fn(),
      };

      queueMicrotask(() => {
        handlers.get('connect')?.forEach((handler) => handler());
      });

      return socket as unknown as net.Socket;
    });

    let alive = true;
    const killSpy = vi
      .spyOn(process, 'kill')
      .mockImplementation(((pid: number, signal?: NodeJS.Signals | number) => {
        if (signal === 0 || signal === undefined) {
          if (pid === metadata.pid && alive) {
            return true;
          }
          throw new Error('process exited');
        }
        if (pid === metadata.pid && signal === 'SIGTERM') {
          alive = false;
          return true;
        }
        return true;
      }) as typeof process.kill);

    const resultPromise = shutdownRunningDaemon(workspace);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({ stopped: true, stoppedSessions: 1 });
    expect(killSpy).toHaveBeenCalledWith(metadata.pid, 'SIGTERM');
  });

  it('prunes stale registered daemons', async () => {
    setupHome();
    const workspace = createWorkspace();
    const transport = getAgentDaemonTransport(workspace, 'linux');
    const entry: RegisteredDaemonInfo = {
      pid: 1234,
      workspace,
      transportKind: transport.kind,
      address: transport.address,
      metadataPath: transport.metadataPath,
      startedAt: 1,
      sessionCount: 0,
      lastSeenAt: 2,
    };

    writeRegistry([entry]);
    vi.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: NodeJS.Signals | number) => {
      if (pid === entry.pid && signal === 0) {
        throw new Error('process exited');
      }
      return true;
    }) as typeof process.kill);

    const result = await pruneRegisteredDaemons();

    expect(result.daemons).toEqual([]);
    expect(result.pruned).toEqual([entry]);
    expect(JSON.parse(fs.readFileSync(getAgentGlobalRegistryPath(), 'utf8'))).toEqual({ daemons: [] });
  });

  it('kill-all shuts down multiple registered daemons and reports stale entries', async () => {
    setupHome();
    const firstWorkspace = createWorkspace();
    const secondWorkspace = createWorkspace();
    const staleWorkspace = createWorkspace();
    const firstTransport = getAgentDaemonTransport(firstWorkspace, 'linux');
    const secondTransport = getAgentDaemonTransport(secondWorkspace, 'linux');
    const staleTransport = getAgentDaemonTransport(staleWorkspace, 'linux');

    const first: RegisteredDaemonInfo = {
      pid: 1111,
      workspace: firstWorkspace,
      transportKind: firstTransport.kind,
      address: firstTransport.address,
      metadataPath: firstTransport.metadataPath,
      startedAt: 1,
      sessionCount: 1,
      lastSeenAt: 2,
    };
    const second: RegisteredDaemonInfo = {
      pid: 2222,
      workspace: secondWorkspace,
      transportKind: secondTransport.kind,
      address: secondTransport.address,
      metadataPath: secondTransport.metadataPath,
      startedAt: 3,
      sessionCount: 2,
      lastSeenAt: 4,
    };
    const stale: RegisteredDaemonInfo = {
      pid: 3333,
      workspace: staleWorkspace,
      transportKind: staleTransport.kind,
      address: staleTransport.address,
      metadataPath: staleTransport.metadataPath,
      startedAt: 5,
      sessionCount: 0,
      lastSeenAt: 6,
    };

    for (const entry of [first, second]) {
      fs.writeFileSync(
        entry.metadataPath,
        JSON.stringify({
          pid: entry.pid,
          workspace: entry.workspace,
          transportKind: entry.transportKind,
          address: entry.address,
          startedAt: entry.startedAt,
          sessionCount: entry.sessionCount,
        } satisfies DaemonInfo),
        'utf8',
      );
    }
    writeRegistry([first, second, stale]);

    let firstAlive = true;
    let secondAlive = true;
    vi.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: NodeJS.Signals | number) => {
      if (signal === 0 || signal === undefined) {
        if (pid === first.pid && firstAlive) {
          return true;
        }
        if (pid === second.pid && secondAlive) {
          return true;
        }
        throw new Error('process exited');
      }

      if (pid === first.pid && signal === 'SIGTERM') {
        firstAlive = false;
        return true;
      }
      if (pid === second.pid && signal === 'SIGTERM') {
        secondAlive = false;
        return true;
      }
      return true;
    }) as typeof process.kill);

    vi.spyOn(net, 'createConnection').mockImplementation((address: net.NetConnectOpts | string) => {
      const targetAddress = typeof address === 'string'
        ? address
        : String((address as { path?: string }).path);
      const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
      const socket = {
        setEncoding: vi.fn(),
        once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          const set = handlers.get(event) ?? new Set();
          set.add(handler);
          handlers.set(event, set);
          return socket;
        }),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          const set = handlers.get(event) ?? new Set();
          set.add(handler);
          handlers.set(event, set);
          return socket;
        }),
        write: vi.fn((payload?: string) => {
          if (payload?.includes('"daemon.shutdown"')) {
            handlers.get('data')?.forEach((handler) =>
              handler(
                `${JSON.stringify({
                  id: '1',
                  ok: true,
                  result: {
                    stopped: true,
                    stoppedSessions: targetAddress === first.address ? 1 : 2,
                  },
                })}\n`,
              ),
            );
            if (targetAddress === first.address) {
              firstAlive = false;
            }
            if (targetAddress === second.address) {
              secondAlive = false;
            }
          }
        }),
        end: vi.fn(),
        destroy: vi.fn(),
      };

      queueMicrotask(() => {
        handlers.get('connect')?.forEach((handler) => handler());
      });

      return socket as unknown as net.Socket;
    });

    const result = await shutdownAllRegisteredDaemons();

    expect(result.killed).toEqual([firstWorkspace, secondWorkspace]);
    expect(result.alreadyStopped).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.pruned).toEqual([staleWorkspace]);
  });

  it('lists registered daemons after pruning stale entries', async () => {
    setupHome();
    const workspace = createWorkspace();
    const staleWorkspace = createWorkspace();
    const transport = getAgentDaemonTransport(workspace, 'linux');
    const staleTransport = getAgentDaemonTransport(staleWorkspace, 'linux');
    const liveEntry: RegisteredDaemonInfo = {
      pid: 1111,
      workspace,
      transportKind: transport.kind,
      address: transport.address,
      metadataPath: transport.metadataPath,
      startedAt: 1,
      sessionCount: 0,
      lastSeenAt: 2,
    };
    const staleEntry: RegisteredDaemonInfo = {
      pid: 2222,
      workspace: staleWorkspace,
      transportKind: staleTransport.kind,
      address: staleTransport.address,
      metadataPath: staleTransport.metadataPath,
      startedAt: 3,
      sessionCount: 0,
      lastSeenAt: 4,
    };

    fs.writeFileSync(
      liveEntry.metadataPath,
      JSON.stringify({
        pid: liveEntry.pid,
        workspace: liveEntry.workspace,
        transportKind: liveEntry.transportKind,
        address: liveEntry.address,
        startedAt: liveEntry.startedAt,
        sessionCount: 1,
      } satisfies DaemonInfo),
      'utf8',
    );
    writeRegistry([liveEntry, staleEntry]);

    vi.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: NodeJS.Signals | number) => {
      if (signal === 0 || signal === undefined) {
        if (pid === liveEntry.pid) {
          return true;
        }
        throw new Error('process exited');
      }
      return true;
    }) as typeof process.kill);

    vi.spyOn(net, 'createConnection').mockImplementation((address: net.NetConnectOpts | string) => {
      const targetAddress = typeof address === 'string'
        ? address
        : String((address as { path?: string }).path);
      const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
      const socket = {
        setEncoding: vi.fn(),
        once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          const set = handlers.get(event) ?? new Set();
          set.add(handler);
          handlers.set(event, set);
          return socket;
        }),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          const set = handlers.get(event) ?? new Set();
          set.add(handler);
          handlers.set(event, set);
          return socket;
        }),
        write: vi.fn((payload?: string) => {
          if (targetAddress === liveEntry.address && payload?.includes('"daemon.health"')) {
            handlers.get('data')?.forEach((handler) =>
              handler(
                `${JSON.stringify({
                  id: '1',
                  ok: true,
                  result: {
                    pid: liveEntry.pid,
                    workspace: liveEntry.workspace,
                    transportKind: liveEntry.transportKind,
                    address: liveEntry.address,
                    startedAt: liveEntry.startedAt,
                    sessionCount: 1,
                  },
                })}\n`,
              ),
            );
          }
        }),
        end: vi.fn(),
        destroy: vi.fn(),
      };

      queueMicrotask(() => {
        handlers.get('connect')?.forEach((handler) => handler());
      });

      return socket as unknown as net.Socket;
    });

    const result = await listRegisteredDaemons();

    expect(result.items).toEqual([
      expect.objectContaining({
        workspace,
        pid: 1111,
        sessionCount: 1,
        status: 'running',
      }),
    ]);
    expect(result.pruned).toEqual([staleWorkspace]);
  });
});
