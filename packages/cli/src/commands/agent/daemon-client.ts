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
import {
  readRegisteredDaemons,
  writeRegisteredDaemons,
  type RegisteredDaemonInfo,
} from './daemon-registry.js';

const CONNECT_TIMEOUT_MS = 5000;
const START_TIMEOUT_MS = 8000;
const SHUTDOWN_TIMEOUT_MS = 5000;
const SHUTDOWN_POLL_INTERVAL_MS = 100;

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

const waitForDaemonExit = async (pid: number, timeoutMs: number): Promise<boolean> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isAlive(pid)) {
      return true;
    }
    await sleep(SHUTDOWN_POLL_INTERVAL_MS);
  }

  return !isAlive(pid);
};

const metadataMatchesTransport = (
  metadata: DaemonInfo | null,
  transport: DaemonTransport,
): metadata is DaemonInfo => {
  return !!metadata &&
    metadata.transportKind === transport.kind &&
    metadata.address === transport.address;
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

const shutdownRunningDaemonByTransport = async (
  transport: DaemonTransport,
  metadata: DaemonInfo | null,
): Promise<(RPCResponseMap['daemon.shutdown'] & { alreadyStopped?: boolean }) | null> => {
  let requestError: Error | null = null;
  let result: RPCResponseMap['daemon.shutdown'] | null = null;

  try {
    const request: RPCRequestEnvelope<'daemon.shutdown'> = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      method: 'daemon.shutdown',
      params: undefined,
    };
    result = await callTransport(transport, request);
  } catch (error) {
    requestError = error as Error;
  }

  if (!metadata || !metadataMatchesTransport(metadata, transport)) {
    if (requestError) {
      throw requestError;
    }
    return result;
  }

  const exitedGracefully = await waitForDaemonExit(metadata.pid, SHUTDOWN_TIMEOUT_MS);
  if (exitedGracefully) {
    if (requestError) {
      return { stopped: true, stoppedSessions: metadata.sessionCount, alreadyStopped: true };
    }
    return result;
  }

  try {
    process.kill(metadata.pid, 'SIGTERM');
  } catch {
    if (requestError) {
      throw requestError;
    }
    return result;
  }
  await waitForDaemonExit(metadata.pid, SHUTDOWN_TIMEOUT_MS);

  if (requestError) {
    return { stopped: true, stoppedSessions: metadata.sessionCount, alreadyStopped: true };
  }

  return result;
};

export const shutdownRunningDaemon = async (
  workspace: string,
): Promise<(RPCResponseMap['daemon.shutdown'] & { alreadyStopped?: boolean }) | null> => {
  const transport = await getRunningDaemonTransport(workspace);
  if (!transport) {
    return null;
  }

  const metadata = readMetadata(workspace);
  return shutdownRunningDaemonByTransport(transport, metadata);
};

const transportFromRegisteredDaemon = (entry: RegisteredDaemonInfo): DaemonTransport => ({
  kind: entry.transportKind,
  address: entry.address,
  metadataPath: entry.metadataPath,
  stateDir: path.dirname(entry.metadataPath),
});

const isRegisteredDaemonStale = async (entry: RegisteredDaemonInfo): Promise<boolean> => {
  const transport = transportFromRegisteredDaemon(entry);
  if (!isAlive(entry.pid)) {
    return true;
  }

  let metadata: DaemonInfo | null = null;
  try {
    metadata = JSON.parse(fs.readFileSync(entry.metadataPath, 'utf8')) as DaemonInfo;
  } catch {
    return true;
  }

  if (!metadataMatchesTransport(metadata, transport) || metadata.workspace !== entry.workspace || metadata.pid !== entry.pid) {
    return true;
  }

  try {
    await waitForDaemonTransport(transport, CONNECT_TIMEOUT_MS);
    return false;
  } catch {
    return true;
  }
};

export const pruneRegisteredDaemons = async (): Promise<{
  daemons: RegisteredDaemonInfo[];
  pruned: RegisteredDaemonInfo[];
}> => {
  const registered = readRegisteredDaemons();
  const live: RegisteredDaemonInfo[] = [];
  const pruned: RegisteredDaemonInfo[] = [];

  for (const entry of registered) {
    if (await isRegisteredDaemonStale(entry)) {
      pruned.push(entry);
      continue;
    }
    live.push(entry);
  }

  writeRegisteredDaemons(live);
  return { daemons: live, pruned };
};

export const shutdownAllRegisteredDaemons = async (): Promise<{
  killed: string[];
  alreadyStopped: string[];
  failed: Array<{ workspace: string; message: string }>;
  pruned: string[];
}> => {
  const { daemons, pruned } = await pruneRegisteredDaemons();
  const killed: string[] = [];
  const alreadyStopped: string[] = [];
  const failed: Array<{ workspace: string; message: string }> = [];

  for (const entry of daemons) {
    try {
      const result = await shutdownRunningDaemonByTransport(
        transportFromRegisteredDaemon(entry),
        entry,
      );
      if (!result || result.alreadyStopped) {
        alreadyStopped.push(entry.workspace);
      } else {
        killed.push(entry.workspace);
      }
    } catch (error) {
      failed.push({
        workspace: entry.workspace,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await pruneRegisteredDaemons();

  return {
    killed,
    alreadyStopped,
    failed,
    pruned: pruned.map((entry) => entry.workspace),
  };
};

export const listRegisteredDaemons = async (): Promise<{
  items: Array<RegisteredDaemonInfo & { status: 'running'; sessionCount: number }>;
  pruned: string[];
}> => {
  const { daemons, pruned } = await pruneRegisteredDaemons();
  const items: Array<RegisteredDaemonInfo & { status: 'running'; sessionCount: number }> = [];

  for (const entry of daemons) {
    const transport = transportFromRegisteredDaemon(entry);
    const info = await callTransport(transport, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      method: 'daemon.health',
      params: undefined,
    });
    items.push({
      ...entry,
      status: 'running',
      sessionCount: info.sessionCount,
    });
  }

  return {
    items,
    pruned: pruned.map((entry) => entry.workspace),
  };
};
