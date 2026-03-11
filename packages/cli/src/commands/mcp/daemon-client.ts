import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type {
  RPCMethod,
  RPCRequestEnvelope,
  RPCRequestMap,
  RPCResponseEnvelope,
  RPCResponseMap,
} from './daemon-protocol.js';
import {
  getMCPDaemonMetadataPath,
  getMCPDaemonSocketPath,
  getMCPWorkspaceStateDir,
} from './daemon-paths.js';

const CONNECT_TIMEOUT_MS = 5000;
const START_TIMEOUT_MS = 8000;

type DaemonMetadata = {
  pid: number;
  socketPath: string;
  workspace: string;
  startedAt: number;
};

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const readMetadata = (workspace: string): DaemonMetadata | null => {
  const metadataPath = getMCPDaemonMetadataPath(workspace);
  try {
    return JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as DaemonMetadata;
  } catch {
    return null;
  }
};

const deleteStaleState = (workspace: string): void => {
  const metadataPath = getMCPDaemonMetadataPath(workspace);
  const socketPath = getMCPDaemonSocketPath(workspace);
  try {
    fs.rmSync(metadataPath, { force: true });
  } catch {}
  if (process.platform !== 'win32') {
    try {
      fs.rmSync(socketPath, { force: true });
    } catch {}
  }
};

const waitForSocket = async (socketPath: string, timeoutMs: number): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection(socketPath);
        socket.once('connect', () => {
          socket.end();
          resolve();
        });
        socket.once('error', (error) => {
          socket.destroy();
          reject(error);
        });
      });
      return;
    } catch {
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    }
  }

  throw new Error(`Timed out waiting for MCP daemon socket at "${socketPath}"`);
};

const getCLIEntrypoint = (): string => {
  let current = path.dirname(fileURLToPath(import.meta.url));

  while (true) {
    const candidate = path.join(current, 'bin.js');
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(candidate) && fs.existsSync(packageJsonPath)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error('Unable to resolve CLI entrypoint for MCP daemon bootstrap');
};

const spawnDaemon = async (workspace: string): Promise<void> => {
  const socketPath = getMCPDaemonSocketPath(workspace);
  const metadataPath = getMCPDaemonMetadataPath(workspace);
  getMCPWorkspaceStateDir(workspace);

  const child = spawn(
    process.execPath,
    [
      getCLIEntrypoint(),
      'mcp',
      'daemon',
      '--workspace',
      workspace,
      '--socket',
      socketPath,
      '--metadata',
      metadataPath,
    ],
    {
      detached: true,
      stdio: 'ignore',
      cwd: workspace,
    },
  );
  child.unref();

  await waitForSocket(socketPath, START_TIMEOUT_MS);
};

const getRunningDaemonSocketPath = async (workspace: string): Promise<string | null> => {
  const socketPath = getMCPDaemonSocketPath(workspace);
  const metadata = readMetadata(workspace);

  if (!metadata || metadata.socketPath !== socketPath || !isAlive(metadata.pid)) {
    if (metadata) {
      deleteStaleState(workspace);
    }
    return null;
  }

  try {
    await waitForSocket(socketPath, CONNECT_TIMEOUT_MS);
    return socketPath;
  } catch {
    deleteStaleState(workspace);
    return null;
  }
};

export const ensureMCPDaemonRunning = async (workspace: string): Promise<string> => {
  const socketPath = getMCPDaemonSocketPath(workspace);
  const metadata = readMetadata(workspace);

  if (metadata && metadata.socketPath === socketPath && isAlive(metadata.pid)) {
    try {
      await waitForSocket(socketPath, CONNECT_TIMEOUT_MS);
      return socketPath;
    } catch {
      deleteStaleState(workspace);
    }
  } else if (metadata) {
    deleteStaleState(workspace);
  }

  await spawnDaemon(workspace);
  return socketPath;
};

export const callDaemon = async <TMethod extends RPCMethod>(
  workspace: string,
  method: TMethod,
  params: RPCRequestMap[TMethod],
): Promise<RPCResponseMap[TMethod]> => {
  const socketPath = await ensureMCPDaemonRunning(workspace);
  const request: RPCRequestEnvelope<TMethod> = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    method,
    params,
  };

  return await new Promise<RPCResponseMap[TMethod]>((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let buffer = '';

    socket.setEncoding('utf8');
    socket.once('error', (error) => {
      reject(error);
    });
    socket.on('data', (chunk) => {
      buffer += chunk;
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) {
        return;
      }

      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      let response: RPCResponseEnvelope<TMethod>;
      try {
        response = JSON.parse(line) as RPCResponseEnvelope<TMethod>;
      } catch {
        reject(new Error('Invalid response from MCP daemon'));
        socket.end();
        return;
      }

      socket.end();
      if (!response.ok) {
        reject(new Error(response.error.message));
        return;
      }

      resolve(response.result);
    });
    socket.once('connect', () => {
      socket.write(`${JSON.stringify(request)}\n`);
    });
  });
};

export const callRunningDaemon = async <TMethod extends RPCMethod>(
  workspace: string,
  method: TMethod,
  params: RPCRequestMap[TMethod],
): Promise<RPCResponseMap[TMethod] | null> => {
  const socketPath = await getRunningDaemonSocketPath(workspace);
  if (!socketPath) {
    return null;
  }

  const request: RPCRequestEnvelope<TMethod> = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    method,
    params,
  };

  return await new Promise<RPCResponseMap[TMethod]>((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let buffer = '';

    socket.setEncoding('utf8');
    socket.once('error', (error) => {
      reject(error);
    });
    socket.on('data', (chunk) => {
      buffer += chunk;
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) {
        return;
      }

      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      let response: RPCResponseEnvelope<TMethod>;
      try {
        response = JSON.parse(line) as RPCResponseEnvelope<TMethod>;
      } catch {
        reject(new Error('Invalid response from MCP daemon'));
        socket.end();
        return;
      }

      socket.end();
      if (!response.ok) {
        reject(new Error(response.error.message));
        return;
      }

      resolve(response.result);
    });
    socket.once('connect', () => {
      socket.write(`${JSON.stringify(request)}\n`);
    });
  });
};
