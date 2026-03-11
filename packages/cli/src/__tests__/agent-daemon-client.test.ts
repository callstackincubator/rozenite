import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteStaleState, readMetadata } from '../commands/agent/daemon-client.js';
import { getAgentDaemonTransport } from '../commands/agent/daemon-paths.js';
import type { DaemonInfo } from '../commands/agent/daemon-protocol.js';

const tempRoots: string[] = [];

const createWorkspace = (): string => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rozenite-daemon-client-'));
  tempRoots.push(workspace);
  return workspace;
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

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
});
