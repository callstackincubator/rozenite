import fs from 'node:fs';
import net from 'node:net';
import type {
  DaemonInfo,
  RPCRequestEnvelope,
  RPCRequestMap,
  RPCResponseEnvelope,
  RPCResponseMap,
} from './daemon-protocol.js';
import { getMCPDaemonSocketPath } from './daemon-paths.js';
import { DaemonSession } from './daemon-session.js';
import { getMetroTargets } from './metro-discovery.js';

type DaemonOptions = {
  workspace: string;
  socketPath: string;
  metadataPath: string;
};

const createSessionId = (): string => {
  return `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
};

class MCPDaemonServer {
  private readonly startedAt = Date.now();
  private readonly sessions = new Map<string, DaemonSession>();
  private shutdownRequested = false;

  constructor(private readonly options: DaemonOptions) {}

  private getInfo(): DaemonInfo {
    return {
      pid: process.pid,
      workspace: this.options.workspace,
      socketPath: this.options.socketPath,
      startedAt: this.startedAt,
      sessionCount: this.sessions.size,
    };
  }

  private async handle(
    request: RPCRequestEnvelope,
  ): Promise<unknown> {
    const { method } = request;
    switch (method) {
      case 'daemon.health':
        return this.getInfo();
      case 'daemon.shutdown': {
        const stoppedSessions = this.sessions.size;
        this.shutdownRequested = true;
        return {
          stopped: true,
          stoppedSessions,
        } satisfies RPCResponseMap['daemon.shutdown'];
      }
      case 'metro.targets': {
        const { host, port } = request.params as RPCRequestMap['metro.targets'];
        return {
          targets: await getMetroTargets(host, port),
        } satisfies RPCResponseMap['metro.targets'];
      }
      case 'session.create': {
        const { host, port, deviceId } = request.params as RPCRequestMap['session.create'];
        const session = new DaemonSession(
          createSessionId(),
          host,
          port,
          deviceId,
        );
        await session.start();
        this.sessions.set(session.id, session);
        this.writeMetadataSafely();
        return { session: session.getInfo() } satisfies RPCResponseMap['session.create'];
      }
      case 'session.list':
        return {
          sessions: Array.from(this.sessions.values()).map((session) => session.getInfo()),
        } satisfies RPCResponseMap['session.list'];
      case 'session.show': {
        const { sessionId } = request.params as RPCRequestMap['session.show'];
        const session = this.getSession(sessionId);
        return { session: session.getInfo() } satisfies RPCResponseMap['session.show'];
      }
      case 'session.stop': {
        const { sessionId } = request.params as RPCRequestMap['session.stop'];
        const session = this.getSession(sessionId);
        await session.stop();
        this.sessions.delete(sessionId);
        this.writeMetadataSafely();
        return { stopped: true } satisfies RPCResponseMap['session.stop'];
      }
      case 'session.tools': {
        const { sessionId } = request.params as RPCRequestMap['session.tools'];
        const session = this.getSession(sessionId);
        return { tools: session.getTools() } satisfies RPCResponseMap['session.tools'];
      }
      case 'session.call-tool': {
        const { sessionId, toolName, args } = request.params as RPCRequestMap['session.call-tool'];
        const session = this.getSession(sessionId);
        return {
          result: await session.callTool(toolName, args),
        } satisfies RPCResponseMap['session.call-tool'];
      }
      default:
        throw new Error(`Unsupported MCP daemon method "${String(method)}"`);
    }
  }

  private getSession(sessionId: string): DaemonSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session "${sessionId}"`);
    }
    return session;
  }

  private writeMetadata(): void {
    fs.writeFileSync(
      this.options.metadataPath,
      JSON.stringify(this.getInfo(), null, 2),
      'utf8',
    );
  }

  private writeMetadataSafely(): void {
    try {
      this.writeMetadata();
    } catch {}
  }

  private async shutdown(): Promise<number> {
    const stoppedSessions = this.sessions.size;
    for (const session of this.sessions.values()) {
      await session.stop();
    }
    this.sessions.clear();
    this.removeSocketArtifacts();
    return stoppedSessions;
  }

  private removeSocketArtifacts(): void {
    try {
      fs.rmSync(this.options.metadataPath, { force: true });
    } catch {}
    if (process.platform !== 'win32') {
      try {
        fs.rmSync(this.options.socketPath, { force: true });
      } catch {}
    }
  }

  async listen(): Promise<void> {
    this.removeSocketArtifacts();

    const server = net.createServer((socket) => {
      let buffer = '';
      socket.setEncoding('utf8');

      socket.on('data', (chunk) => {
        buffer += chunk;
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex === -1) {
          return;
        }

        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        void this.handleConnectionLine(line, socket);
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.options.socketPath, () => {
        this.writeMetadata();
        resolve();
      });
    });

    const shutdown = async () => {
      await this.shutdown();
      server.close();
    };

    process.on('SIGINT', () => {
      void shutdown().finally(() => process.exit(0));
    });
    process.on('SIGTERM', () => {
      void shutdown().finally(() => process.exit(0));
    });
  }

  private async handleConnectionLine(line: string, socket: net.Socket): Promise<void> {
    let request: RPCRequestEnvelope;
    try {
      request = JSON.parse(line) as RPCRequestEnvelope;
    } catch {
      socket.write(`${JSON.stringify({
        id: 'invalid',
        ok: false,
        error: { message: 'Invalid daemon request payload' },
      } satisfies RPCResponseEnvelope)}\n`);
      socket.end();
      return;
    }

    try {
      const result = await this.handle(request);
      socket.write(
        `${JSON.stringify({
          id: request.id,
          ok: true,
          result,
        } as RPCResponseEnvelope)}\n`,
      );
    } catch (error) {
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
    if (this.shutdownRequested) {
      this.shutdownRequested = false;
      setImmediate(() => {
        void this.shutdown().finally(() => process.exit(0));
      });
    }
  }
}

export const runMCPDaemonServer = async (options: DaemonOptions): Promise<void> => {
  const socketPath = options.socketPath || getMCPDaemonSocketPath(options.workspace);
  const server = new MCPDaemonServer({
    ...options,
    socketPath,
  });
  await server.listen();
  await new Promise(() => {});
};
