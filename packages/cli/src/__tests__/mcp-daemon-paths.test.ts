import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getMCPDaemonMetadataPath,
  getMCPDaemonSocketPath,
  getMCPWorkspaceStateDir,
} from '../commands/mcp/daemon-paths.js';

describe('mcp daemon paths', () => {
  it('stores daemon artifacts inside the workspace state dir', () => {
    const workspace = path.join(os.tmpdir(), 'rozenite-daemon-paths-workspace');

    const stateDir = getMCPWorkspaceStateDir(workspace);
    const socketPath = getMCPDaemonSocketPath(workspace);
    const metadataPath = getMCPDaemonMetadataPath(workspace);

    expect(stateDir).toBe(path.join(workspace, '.rozenite'));
    if (process.platform === 'win32') {
      expect(socketPath.startsWith('\\\\.\\pipe\\rozenite-mcp-')).toBe(true);
    } else {
      expect(socketPath.endsWith('.sock')).toBe(true);
    }
    expect(metadataPath).toBe(path.join(stateDir, 'mcp-daemon.json'));
  });
});
