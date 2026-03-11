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
  DaemonInfo,
} from './daemon-protocol.js';
import { createAgentDaemonLogger } from './daemon-logger.js';
import {
  getAgentDaemonTransport,
  type DaemonTransport,
} from './daemon-paths.js';

const CONNECT_TIMEOUT_MS = 5000;
const START_TIMEOUT_MS = 8000;

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export const readMetadata = (workspace: string): DaemonInfo | null => {
  const transport = getAgentDaemonTransport(workspace);
  try {
    return JSON.parse(fs.readFileSync(transport.metadataPath, 'utf8')) as DaemonInfo;
  } catch {
    return null;
  }
};

export const deleteStaleState = (
  workspace: string,
  transport: DaemonTransport = getAgentDaemonTransport(workspace),
): void => {
  try {
    fs.rmSync(transport.metadataPath, { force: true });
  } catch {}
  if (transport.kind === 'unix-socket') {
    try {
      fs.rmSync(transport.address, { force: true });
    } catch {}
  }
};

export const connectToDaemonTransport = (transport: DaemonTransport): net.Socket => {
  return net.createConnection(transport.address);
};

export const waitForDaemonTransport = async (
  transport: DaemonTransport,
  timeoutMs: number,
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = connectToDaemonTransport(transport);
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

  throw new Error(
    `Timed out waiting for Agent daemon ${transport.kind} at "${transport.address}"`,
  );
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

  throw new Error('Unable to resolve CLI entrypoint for Agent daemon bootstrap');
};

const spawnDaemon = async (workspace: string): Promise<void> => {
  const transport = getAgentDaemonTransport(workspace);
  const logger = createAgentDaemonLogger(workspace, {
    component: 'agent-daemon-bootstrap',
  });
  logger.info('Spawning daemon process', {
    transportKind: transport.kind,
    transportAddress: transport.address,
  });

  const child = spawn(
    process.execPath,
    [
      getCLIEntrypoint(),
      'agent',
      'daemon',
      '--workspace',
      workspace,
    ],
    {
      detached: true,
      stdio: 'ignore',
      cwd: workspace,
    },
  );
  child.unref();

  await waitForDaemonTransport(transport, START_TIMEOUT_MS);
  logger.info('Daemon process reported ready', {
    pid: child.pid || null,
  });
};

const getRunningDaemonTransport = async (workspace: string): Promise<DaemonTransport | null> => {
  const transport = getAgentDaemonTransport(workspace);
  const metadata = readMetadata(workspace);

  if (
    !metadata ||
    metadata.transportKind !== transport.kind ||
    metadata.address !== transport.address ||
    !isAlive(metadata.pid)
  ) {
    if (metadata) {
      deleteStaleState(workspace, transport);
    }
    return null;
  }

  try {
    await waitForDaemonTransport(transport, CONNECT_TIMEOUT_MS);
    return transport;
  } catch {
    deleteStaleState(workspace, transport);
    return null;
  }
};

export const ensureAgentDaemonRunning = async (workspace: string): Promise<DaemonTransport> => {
  const transport = getAgentDaemonTransport(workspace);
  const metadata = readMetadata(workspace);
  const logger = createAgentDaemonLogger(workspace, {
    component: 'agent-daemon-bootstrap',
  });

  if (
    metadata &&
    metadata.transportKind === transport.kind &&
    metadata.address === transport.address &&
    isAlive(metadata.pid)
  ) {
    try {
      await waitForDaemonTransport(transport, CONNECT_TIMEOUT_MS);
      logger.debug('Using existing daemon process', {
        pid: metadata.pid,
      });
      return transport;
    } catch {
      logger.warn('Existing daemon metadata was stale; deleting state', {
        pid: metadata.pid,
      });
      deleteStaleState(workspace, transport);
    }
  } else if (metadata) {
    logger.warn('Deleting mismatched daemon metadata before restart', {
      pid: metadata.pid,
    });
    deleteStaleState(workspace, transport);
  }

  await spawnDaemon(workspace);
  return transport;
};

const callTransport = async <TMethod extends RPCMethod>(
  transport: DaemonTransport,
  request: RPCRequestEnvelope<TMethod>,
): Promise<RPCResponseMap[TMethod]> => {
  return await new Promise<RPCResponseMap[TMethod]>((resolve, reject) => {
    const socket = connectToDaemonTransport(transport);
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
        reject(new Error('Invalid response from Agent daemon'));
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

export const callDaemon = async <TMethod extends RPCMethod>(
  workspace: string,
  method: TMethod,
  params: RPCRequestMap[TMethod],
): Promise<RPCResponseMap[TMethod]> => {
  const transport = await ensureAgentDaemonRunning(workspace);
  const request: RPCRequestEnvelope<TMethod> = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    method,
    params,
  };

  return callTransport(transport, request);
};

export const callRunningDaemon = async <TMethod extends RPCMethod>(
  workspace: string,
  method: TMethod,
  params: RPCRequestMap[TMethod],
): Promise<RPCResponseMap[TMethod] | null> => {
  const transport = await getRunningDaemonTransport(workspace);
  if (!transport) {
    return null;
  }

  const request: RPCRequestEnvelope<TMethod> = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    method,
    params,
  };

  return callTransport(transport, request);
};
