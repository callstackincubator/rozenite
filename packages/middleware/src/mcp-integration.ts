import { Server as HttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { MCPWebSocketServer, MCPMessageHandler } from '@rozenite/mcp-server';
import { logger } from './logger.js';

let mcpServer: MCPWebSocketServer | null = null;
let mcpHandler: MCPMessageHandler = new MCPMessageHandler();

export function getMCPWebSocketServer(): WebSocketServer {
  if (!mcpServer) {
    mcpServer = new MCPWebSocketServer({ noServer: true }, mcpHandler);
  }
  return mcpServer.getWss();
}

export function initializeMCPServer(
  server: HttpServer,
  _metroPort: number = 8081,
): MCPMessageHandler {
  if (mcpServer) {
    // If it was already created via getMCPWebSocketServer, it's already using mcpHandler
    return mcpHandler;
  }

  logger.info('Initializing MCP WebSocket server on /rozenite-mcp');

  // Create the MCP WebSocket server for LLM clients
  mcpServer = new MCPWebSocketServer(
    {
      server,
      path: '/rozenite-mcp',
    },
    mcpHandler,
  );

  logger.info('MCP server initialized successfully');
  return mcpHandler;
}

export function shutdownMCPServer(): void {
  if (mcpServer) {
    mcpServer.close();
    mcpServer = null;
  }
}

export function getMCPHandler(): MCPMessageHandler {
  return mcpHandler;
}
