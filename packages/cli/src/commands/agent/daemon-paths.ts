import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

const STATE_DIRNAME = '.rozenite';
const SOCKET_FILENAME = 'agent-daemon.sock';
const METADATA_FILENAME = 'agent-daemon.json';
const LOG_FILENAME = 'agent-daemon.log';
const GLOBAL_REGISTRY_FILENAME = 'agent-daemons.json';

export type DaemonTransportKind = 'unix-socket' | 'windows-pipe';

export type DaemonTransport = {
  kind: DaemonTransportKind;
  address: string;
  metadataPath: string;
  stateDir: string;
};

const ensureDir = (dir: string): void => {
  fs.mkdirSync(dir, { recursive: true });
};

const getWorkspaceHash = (workspace: string): string => {
  return crypto.createHash('sha256').update(workspace).digest('hex').slice(0, 24);
};

export const getAgentWorkspaceStateDir = (workspace: string): string => {
  const dir = path.join(workspace, STATE_DIRNAME);
  ensureDir(dir);
  return dir;
};

export const getGlobalRozeniteStateDir = (): string => {
  const dir = path.join(os.homedir(), STATE_DIRNAME);
  ensureDir(dir);
  return dir;
};

export const getAgentGlobalRegistryPath = (): string => {
  return path.join(getGlobalRozeniteStateDir(), GLOBAL_REGISTRY_FILENAME);
};

export const getAgentDaemonMetadataPath = (workspace: string): string => {
  return path.join(getAgentWorkspaceStateDir(workspace), METADATA_FILENAME);
};

export const getAgentDaemonLogPath = (workspace: string): string => {
  return path.join(getAgentWorkspaceStateDir(workspace), LOG_FILENAME);
};

export const getAgentDaemonTransport = (
  workspace: string,
  platform: NodeJS.Platform = process.platform,
): DaemonTransport => {
  const stateDir = getAgentWorkspaceStateDir(workspace);
  const metadataPath = path.join(stateDir, METADATA_FILENAME);
  const workspaceHash = getWorkspaceHash(workspace);

  if (platform === 'win32') {
    return {
      kind: 'windows-pipe',
      address: `\\\\.\\pipe\\rozenite-agent-${workspaceHash}`,
      metadataPath,
      stateDir,
    };
  }

  const socketAddress = path.join(stateDir, SOCKET_FILENAME);
  if (socketAddress.length < 100) {
    return {
      kind: 'unix-socket',
      address: socketAddress,
      metadataPath,
      stateDir,
    };
  }

  return {
    kind: 'unix-socket',
    address: path.join(os.tmpdir(), `rozenite-agent-${workspaceHash}.sock`),
    metadataPath,
    stateDir,
  };
};
