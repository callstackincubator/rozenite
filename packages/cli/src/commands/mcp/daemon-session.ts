import WebSocket from 'ws';
import {
  mcp,
} from '@rozenite/middleware';
import type { MetroTarget, SessionInfo, SessionStatus } from './daemon-protocol.js';
import { resolveMetroTarget } from './metro-discovery.js';

const {
  createMCPMessageHandler,
  extractConsoleMessage,
  parseRozeniteBindingPayload,
} = mcp;

type DevToolsPluginMessage = mcp.DevToolsPluginMessage;
type MCPMessageHandler = mcp.MCPMessageHandler;

const RUNTIME_GLOBAL = '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__';
const BOOTSTRAP_DELAY_MS = 500;
const RECONNECT_DELAY_MS = 1000;

type PendingCommand = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class DaemonSession {
  private readonly handler: MCPMessageHandler;
  private readonly createdAt = Date.now();
  private lastActivityAt = this.createdAt;
  private connectedAt?: number;
  private lastError?: string;
  private status: SessionStatus = 'connecting';
  private target?: MetroTarget;
  private ws: WebSocket | null = null;
  private stopped = false;
  private nextCommandId = 1;
  private readonly pendingCommands = new Map<number, PendingCommand>();
  private bootstrapTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private bindingName: string | null = null;
  private bootstrapped = false;

  constructor(
    readonly id: string,
    private readonly host: string,
    private readonly port: number,
    private readonly requestedDeviceId?: string,
  ) {
    this.handler = createMCPMessageHandler();
  }

  async start(): Promise<void> {
    await this.connect();
  }

  private touch(): void {
    this.lastActivityAt = Date.now();
  }

  private async connect(): Promise<void> {
    this.status = 'connecting';
    this.target = await resolveMetroTarget(this.host, this.port, this.requestedDeviceId);

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.target!.webSocketDebuggerUrl);
      let settled = false;
      this.ws = ws;

      ws.once('open', () => {
        settled = true;
        this.status = 'connected';
        this.connectedAt = Date.now();
        this.lastError = undefined;
        this.touch();
        this.handler.connectDevice(
          this.target!.id,
          this.target!.name,
          {
            sendMessage: (message: unknown) => {
              void this.sendDomainMessage('rozenite', message);
            },
            sendReactDevToolsMessage: (message: { event: string; payload: unknown }) => {
              void this.sendDomainMessage('react-devtools', message);
            },
          },
        );
        void this.sendCommand('Runtime.enable');
        this.scheduleBootstrap();
        resolve();
      });

      ws.on('message', (rawMessage) => {
        this.handleSocketMessage(rawMessage.toString());
      });

      ws.once('error', (error) => {
        this.lastError = error.message;
        if (!settled) {
          reject(error);
        }
      });

      ws.once('close', () => {
        this.handleSocketClosed();
        if (!settled) {
          reject(new Error('CDP websocket closed before session initialization'));
        }
      });
    });
  }

  private handleSocketClosed(): void {
    this.bindingName = null;
    this.bootstrapped = false;
    this.connectedAt = undefined;
    if (this.target) {
      this.handler.disconnectDevice(this.target.id);
    }

    for (const [id, pending] of this.pendingCommands.entries()) {
      this.pendingCommands.delete(id);
      pending.reject(new Error('CDP connection closed'));
    }

    if (this.stopped) {
      this.status = 'stopped';
      return;
    }

    this.status = 'disconnected';
    this.scheduleReconnect();
  }

  private scheduleBootstrap(): void {
    if (this.bootstrapTimer) {
      clearTimeout(this.bootstrapTimer);
    }
    this.bootstrapTimer = setTimeout(() => {
      void this.bootstrap();
    }, BOOTSTRAP_DELAY_MS);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.stopped) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch((error: Error) => {
        this.lastError = error.message;
        this.status = 'disconnected';
        this.scheduleReconnect();
      });
    }, RECONNECT_DELAY_MS);
  }

  private async bootstrap(): Promise<void> {
    if (this.stopped || !this.ws || this.ws.readyState !== WebSocket.OPEN || this.bootstrapped) {
      return;
    }

    try {
      const bindingResponse = await this.sendCommand('Runtime.evaluate', {
        expression: `typeof ${RUNTIME_GLOBAL} !== "undefined" && typeof ${RUNTIME_GLOBAL}.BINDING_NAME === "string" ? ${RUNTIME_GLOBAL}.BINDING_NAME : null`,
      }) as { result?: { value?: unknown } };

      const bindingName = bindingResponse?.result?.value;
      if (typeof bindingName !== 'string' || !bindingName) {
        throw new Error('Rozenite runtime binding is not initialized yet');
      }

      if (this.bindingName !== bindingName) {
        await this.sendCommand('Runtime.addBinding', { name: bindingName });
        this.bindingName = bindingName;
      }

      await this.sendCommand('Runtime.evaluate', {
        expression: `void ${RUNTIME_GLOBAL}.initializeDomain("rozenite")`,
      });
      await this.sendCommand('Runtime.evaluate', {
        expression: `void ${RUNTIME_GLOBAL}.initializeDomain("react-devtools")`,
      });

      this.bootstrapped = true;
      this.lastError = undefined;
      this.touch();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.scheduleBootstrap();
    }
  }

  private async sendDomainMessage(domain: string, message: unknown): Promise<void> {
    const serializedMessage = JSON.stringify(message);
    const escapedMessage = JSON.stringify(serializedMessage);
    await this.sendCommand('Runtime.evaluate', {
      expression: `${RUNTIME_GLOBAL}.sendMessage(${JSON.stringify(domain)}, ${escapedMessage})`,
    });
  }

  private async sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('CDP websocket is not connected');
    }

    const id = this.nextCommandId++;
    const payload = JSON.stringify({ id, method, params });
    this.touch();

    return await new Promise((resolve, reject) => {
      this.pendingCommands.set(id, { resolve, reject });
      this.ws!.send(payload, (error) => {
        if (!error) {
          return;
        }

        this.pendingCommands.delete(id);
        reject(error);
      });
    });
  }

  private handleSocketMessage(rawMessage: string): void {
    this.touch();

    let message: Record<string, unknown>;
    try {
      message = JSON.parse(rawMessage) as Record<string, unknown>;
    } catch {
      return;
    }

    if (typeof message.id === 'number') {
      const pending = this.pendingCommands.get(message.id);
      if (!pending) {
        return;
      }

      this.pendingCommands.delete(message.id);
      if (message.error) {
        pending.reject(new Error(JSON.stringify(message.error)));
        return;
      }
      pending.resolve(message);
      return;
    }

    if (message.method === 'Runtime.executionContextCreated' || message.method === 'Runtime.executionContextsCleared') {
      this.bootstrapped = false;
      this.scheduleBootstrap();
    }

    const consoleMessage = extractConsoleMessage(message);
    if (consoleMessage && this.target) {
      this.handler.captureConsoleMessage(this.target.id, consoleMessage);
    }

    const bindingPayload = parseRozeniteBindingPayload(message);
    if (!bindingPayload || !this.target) {
      return;
    }

    if (bindingPayload.domain === 'rozenite') {
      this.handler.handleDeviceMessage(this.target.id, bindingPayload.message as DevToolsPluginMessage);
    } else if (bindingPayload.domain === 'react-devtools') {
      void this.handler.captureReactDevToolsMessage(this.target.id, bindingPayload.message);
    }
  }

  getInfo(): SessionInfo {
    const toolCount = this.target ? this.handler.getTools(this.target.id).length : 0;
    return {
      id: this.id,
      host: this.host,
      port: this.port,
      deviceId: this.target?.id || this.requestedDeviceId || 'unknown',
      deviceName: this.target?.name || 'Unknown',
      appId: this.target?.appId || 'Unknown',
      pageId: this.target?.pageId || 'unknown',
      status: this.status,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      ...(this.connectedAt ? { connectedAt: this.connectedAt } : {}),
      ...(this.lastError ? { lastError: this.lastError } : {}),
      toolCount,
    };
  }

  getTools() {
    if (!this.target) {
      return [];
    }
    return this.handler.getTools(this.target.id);
  }

  async callTool(toolName: string, args: unknown): Promise<unknown> {
    if (!this.target) {
      throw new Error(`Session "${this.id}" is not connected to a device`);
    }
    this.touch();
    return await this.handler.callTool(toolName, args);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.bootstrapTimer) {
      clearTimeout(this.bootstrapTimer);
      this.bootstrapTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.target) {
      this.handler.disconnectDevice(this.target.id);
    }
    this.status = 'stopped';
  }
}
