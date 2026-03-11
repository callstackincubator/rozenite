import fs from 'node:fs';
import net from 'node:net';
import type {
  DaemonInfo,
  RPCRequestEnvelope,
  RPCRequestMap,
  RPCResponseEnvelope,
  RPCResponseMap,
} from './daemon-protocol.js';
import { createAgentDaemonLogger } from './daemon-logger.js';
import { getAgentDaemonTransport, type DaemonTransport } from './daemon-paths.js';
import { createDaemonSession, type DaemonSession } from './daemon-session.js';
import { getMetroTargets } from './metro-discovery.js';

type DaemonOptions = {
  workspace: string;
  transport?: DaemonTransport;
};

type AgentDaemonServer = ReturnType<typeof createAgentDaemonServer>;

const createSessionId = (): string => {
  return `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
};

export const createAgentDaemonServer = (options: DaemonOptions) => {
  const transport = options.transport || getAgentDaemonTransport(options.workspace);
  const logger = createAgentDaemonLogger(options.workspace, {
    component: 'agent-daemon',
    transportKind: transport.kind,
    transportAddress: transport.address,
  });
  const startedAt = Date.now();
  const sessions = new Map<string, DaemonSession>();
  let shutdownRequested = false;

  const getInfo = (): DaemonInfo => ({
    pid: process.pid,
    workspace: options.workspace,
    transportKind: transport.kind,
    address: transport.address,
    startedAt,
    sessionCount: sessions.size,
  });

  const writeMetadata = (): void => {
    fs.writeFileSync(
      transport.metadataPath,
      JSON.stringify(getInfo(), null, 2),
      'utf8',
    );
  };

  const writeMetadataSafely = (): void => {
    try {
      writeMetadata();
    } catch {}
  };

  const removeDaemonStateArtifacts = (): void => {
    try {
      fs.rmSync(transport.metadataPath, { force: true });
    } catch {}
    if (transport.kind === 'unix-socket') {
      try {
        fs.rmSync(transport.address, { force: true });
      } catch {}
    }
  };

  const getSession = (sessionId: string): DaemonSession => {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session "${sessionId}"`);
    }
    return session;
  };

  const shutdown = async (): Promise<number> => {
    const stoppedSessions = sessions.size;
    logger.info('Shutting down daemon', {
      stoppedSessions,
    });
    for (const session of sessions.values()) {
      await session.stop();
    }
    sessions.clear();
    removeDaemonStateArtifacts();
    return stoppedSessions;
  };

  const handle = async (request: RPCRequestEnvelope): Promise<unknown> => {
    logger.info('Handling daemon RPC request', {
      requestId: request.id,
      method: request.method,
    });
    switch (request.method) {
      case 'daemon.health':
        return getInfo();
      case 'daemon.shutdown': {
        const stoppedSessions = sessions.size;
        shutdownRequested = true;
        logger.info('Daemon shutdown requested', {
          stoppedSessions,
        });
        return {
          stopped: true,
          stoppedSessions,
        } satisfies RPCResponseMap['daemon.shutdown'];
      }
      case 'metro.targets': {
        const { host, port } = request.params as RPCRequestMap['metro.targets'];
        logger.info('Listing Metro targets', {
          host,
          port,
        });
        return {
          targets: await getMetroTargets(host, port),
        } satisfies RPCResponseMap['metro.targets'];
      }
      case 'session.create': {
        const { host, port, deviceId } = request.params as RPCRequestMap['session.create'];
        const sessionId = createSessionId();
        logger.info('Creating session', {
          sessionId,
          host,
          port,
          deviceId: deviceId || null,
        });
        const session = createDaemonSession(
          sessionId,
          host,
          port,
          deviceId,
          (sessionId) => {
            sessions.delete(sessionId);
            writeMetadataSafely();
            logger.warn('Session removed after termination', {
              sessionId,
            });
          },
          logger,
        );
        await session.start();
        sessions.set(session.id, session);
        writeMetadataSafely();
        logger.info('Session created', {
          sessionId: session.id,
          status: session.getInfo().status,
        });
        return { session: session.getInfo() } satisfies RPCResponseMap['session.create'];
      }
      case 'session.list':
        logger.debug('Listing sessions', {
          sessionCount: sessions.size,
        });
        return {
          sessions: Array.from(sessions.values()).map((session) => session.getInfo()),
        } satisfies RPCResponseMap['session.list'];
      case 'session.show': {
        const { sessionId } = request.params as RPCRequestMap['session.show'];
        logger.debug('Showing session', {
          sessionId,
        });
        return { session: getSession(sessionId).getInfo() } satisfies RPCResponseMap['session.show'];
      }
      case 'session.stop': {
        const { sessionId } = request.params as RPCRequestMap['session.stop'];
        logger.info('Stopping session via RPC', {
          sessionId,
        });
        const session = getSession(sessionId);
        await session.stop();
        sessions.delete(sessionId);
        writeMetadataSafely();
        return { stopped: true } satisfies RPCResponseMap['session.stop'];
      }
      case 'session.tools': {
        const { sessionId } = request.params as RPCRequestMap['session.tools'];
        logger.debug('Listing session tools', {
          sessionId,
        });
        return { tools: getSession(sessionId).getTools() } satisfies RPCResponseMap['session.tools'];
      }
      case 'session.call-tool': {
        const { sessionId, toolName, args } = request.params as RPCRequestMap['session.call-tool'];
        logger.info('Calling session tool via RPC', {
          sessionId,
          toolName,
          hasArgs: args !== undefined,
        });
        return {
          result: await getSession(sessionId).callTool(toolName, args),
        } satisfies RPCResponseMap['session.call-tool'];
      }
      default:
        throw new Error(`Unsupported Agent daemon method "${String(request.method)}"`);
    }
  };

  const handleConnectionLine = async (line: string, socket: net.Socket): Promise<void> => {
    let request: RPCRequestEnvelope;
    try {
      request = JSON.parse(line) as RPCRequestEnvelope;
    } catch {
      logger.warn('Received invalid daemon request payload');
      socket.write(`${JSON.stringify({
        id: 'invalid',
        ok: false,
        error: { message: 'Invalid daemon request payload' },
      } satisfies RPCResponseEnvelope)}\n`);
      socket.end();
      return;
    }

    try {
      const result = await handle(request);
      logger.debug('Daemon RPC request succeeded', {
        requestId: request.id,
        method: request.method,
      });
      socket.write(
        `${JSON.stringify({
          id: request.id,
          ok: true,
          result,
        } as RPCResponseEnvelope)}\n`,
      );
    } catch (error) {
      logger.error('Daemon RPC request failed', {
        requestId: request.id,
        method: request.method,
        error,
      });
      socket.write(
        `${JSON.stringify({
          id: request.id,
          ok: false,
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        } satisfies RPCResponseEnvelope)}\n`,
      );
    }

    socket.end();
    if (shutdownRequested) {
      shutdownRequested = false;
      setImmediate(() => {
        void shutdown().finally(() => process.exit(0));
      });
    }
  };

  const listenOnDaemonTransport = async (server: net.Server): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(transport.address, () => {
        writeMetadata();
        logger.info('Daemon transport is listening', {
          logPath: logger.getLogPath(),
        });
        resolve();
      });
    });
  };

  const listen = async (): Promise<void> => {
    removeDaemonStateArtifacts();
    logger.info('Starting daemon server', {
      startedAt,
      logPath: logger.getLogPath(),
    });

    const server = net.createServer((socket) => {
      let buffer = '';
      socket.setEncoding('utf8');
      logger.debug('Accepted daemon transport connection');

      socket.on('data', (chunk) => {
        buffer += chunk;
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex === -1) {
          return;
        }

        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        void handleConnectionLine(line, socket);
      });
    });

    await listenOnDaemonTransport(server);

    const shutdownAndExit = async () => {
      logger.info('Received shutdown signal');
      await shutdown();
      server.close();
    };

    process.on('SIGINT', () => {
      void shutdownAndExit().finally(() => process.exit(0));
    });
    process.on('SIGTERM', () => {
      void shutdownAndExit().finally(() => process.exit(0));
    });
    process.on('uncaughtException', (error) => {
      logger.error('Unhandled exception in daemon process', {
        error,
      });
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection in daemon process', {
        reason,
      });
    });
  };

  return {
    listen,
    shutdown,
  };
};

export const runAgentDaemonServer = async (options: DaemonOptions): Promise<void> => {
  const server: AgentDaemonServer = createAgentDaemonServer(options);
  await server.listen();
  await new Promise(() => {});
};
