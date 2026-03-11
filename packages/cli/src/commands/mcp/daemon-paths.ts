import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STATE_DIRNAME = '.rozenite';
const SOCKET_FILENAME = 'mcp-daemon.sock';
const METADATA_FILENAME = 'mcp-daemon.json';

const ensureDir = (dir: string): void => {
  fs.mkdirSync(dir, { recursive: true });
};

export const getMCPWorkspaceStateDir = (workspace: string): string => {
  const dir = path.join(workspace, STATE_DIRNAME);
  ensureDir(dir);
  return dir;
};

export const getMCPDaemonMetadataPath = (workspace: string): string => {
  return path.join(getMCPWorkspaceStateDir(workspace), METADATA_FILENAME);
};

export const getMCPDaemonSocketPath = (workspace: string): string => {
  const stateDir = getMCPWorkspaceStateDir(workspace);
  if (process.platform === 'win32') {
    const sanitized = stateDir.replace(/[:\\\/]/g, '-');
    return `\\\\.\\pipe\\rozenite-mcp-${sanitized}`;
  }

  const socketPath = path.join(stateDir, SOCKET_FILENAME);
  if (socketPath.length < 100) {
    return socketPath;
  }

  const shortened = path.join(
    os.tmpdir(),
    `rozenite-mcp-${Buffer.from(workspace).toString('base64url').slice(0, 24)}.sock`,
  );
  return shortened;
};
