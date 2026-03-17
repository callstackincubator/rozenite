import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getAgentGlobalRegistryPath,
  getGlobalRozeniteStateDir,
  getAgentDaemonMetadataPath,
  getAgentDaemonTransport,
  getAgentWorkspaceStateDir,
} from '../commands/agent/daemon-paths.js';

describe('agent daemon transport', () => {
  it('stores metadata inside the workspace state dir', () => {
    const workspace = path.join(os.tmpdir(), 'rozenite-daemon-paths-workspace');

    const stateDir = getAgentWorkspaceStateDir(workspace);
    const transport = getAgentDaemonTransport(workspace, 'darwin');
    const metadataPath = getAgentDaemonMetadataPath(workspace);

    expect(stateDir).toBe(path.join(workspace, '.rozenite'));
    expect(transport.stateDir).toBe(stateDir);
    expect(transport.metadataPath).toBe(path.join(stateDir, 'agent-daemon.json'));
    expect(metadataPath).toBe(transport.metadataPath);
  });

  it('stores the global registry in the home rozenite directory', () => {
    const homeDir = os.homedir();

    expect(getGlobalRozeniteStateDir()).toBe(path.join(homeDir, '.rozenite'));
    expect(getAgentGlobalRegistryPath()).toBe(path.join(homeDir, '.rozenite', 'agent-daemons.json'));
  });

  it('uses a unix socket path on unix platforms', () => {
    const workspace = path.join(os.tmpdir(), 'rozenite-daemon-paths-unix');

    const transport = getAgentDaemonTransport(workspace, 'linux');

    expect(transport.kind).toBe('unix-socket');
    expect(transport.address.endsWith('.sock')).toBe(true);
    expect(
      transport.address === path.join(transport.stateDir, 'agent-daemon.sock') ||
      transport.address.startsWith(os.tmpdir()),
    ).toBe(true);
  });

  it('uses a deterministic hashed pipe name on windows', () => {
    const workspace = 'C:\\workspaces\\rn-devtools';

    const first = getAgentDaemonTransport(workspace, 'win32');
    const second = getAgentDaemonTransport(workspace, 'win32');
    const third = getAgentDaemonTransport('C:\\workspaces\\another-repo', 'win32');

    expect(first.kind).toBe('windows-pipe');
    expect(first.address.startsWith('\\\\.\\pipe\\rozenite-agent-')).toBe(true);
    expect(first.address).toBe(second.address);
    expect(first.address).not.toBe(third.address);
  });
});
