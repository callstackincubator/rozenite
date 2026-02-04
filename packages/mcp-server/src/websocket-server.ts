import WebSocket, { WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';
import { MCPMessageHandler } from './handler.js';
import type { MCPTool } from './types.js';

export interface MCPWebSocketServerOptions {
  server?: HttpServer;
  noServer?: boolean;
  path?: string;
}

interface CustomToolCall {
  type: 'tool/call';
  id: string;
  name: string;
  arguments: unknown;
}

interface CustomToolsList {
  type: 'tools/list';
  tools: MCPTool[];
}

interface CustomToolResult {
  type: 'tool/result';
  id: string;
  result?: unknown;
  error?: string;
}

type CustomMessage = CustomToolCall | CustomToolsList | CustomToolResult;

export class MCPWebSocketServer {
  private wss: WebSocketServer;
  private handler: MCPMessageHandler;
  private clients: Set<WebSocket> = new Set();

  constructor(options: MCPWebSocketServerOptions, handler?: MCPMessageHandler) {
    this.handler = handler || new MCPMessageHandler();

    this.wss = new WebSocketServer({
      server: options.server,
      noServer: options.noServer,
      path: options.noServer ? undefined : options.path || '/rozenite-mcp',
    });

    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });

    // Notify clients when tools change
    this.handler.onToolsChanged(() => {
      this.notifyToolsChanged();
    });
  }

  handleConnection(ws: WebSocket): void {
    console.log('NEW CONNECTION!');
    this.clients.add(ws);

    ws.on('message', async (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString()) as CustomMessage;

        if (message.type === 'tool/call') {
          await this.handleToolCall(ws, message);
        }
      } catch (error) {
        console.error('Failed to handle message:', error);
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });

    // Send initial tools list
    this.sendToolsList(ws);
  }

  private async handleToolCall(
    ws: WebSocket,
    message: CustomToolCall,
  ): Promise<void> {
    try {
      const result = await this.handler.callTool(
        message.name,
        message.arguments || {},
      );

      const response: CustomToolResult = {
        type: 'tool/result',
        id: message.id,
        result: result,
      };
      ws.send(JSON.stringify(response));
    } catch (error) {
      const response: CustomToolResult = {
        type: 'tool/result',
        id: message.id,
        error: error instanceof Error ? error.message : 'Tool call failed',
      };
      ws.send(JSON.stringify(response));
    }
  }

  private sendToolsList(ws: WebSocket): void {
    const tools = this.handler.getTools();
    const message: CustomToolsList = {
      type: 'tools/list',
      tools: tools.map((tool: MCPTool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
    ws.send(JSON.stringify(message));
  }

  private notifyToolsChanged(): void {
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        this.sendToolsList(client);
      }
    }
  }

  getHandler(): MCPMessageHandler {
    return this.handler;
  }

  getWss(): WebSocketServer {
    return this.wss;
  }

  close(): void {
    this.wss.close();
  }
}
