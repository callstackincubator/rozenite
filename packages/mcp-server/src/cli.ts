#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import WebSocket from 'ws';
import type { MCPTool } from './types.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

interface CLIOptions {
  port?: number;
  host?: string;
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


function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--port':
      case '-p':
        options.port = parseInt(args[++i], 10);
        break;
      case '--host':
      case '-h':
        options.host = args[++i];
        break;
      case '--help':
        console.log(`
Usage: rozenite-mcp [options]

Options:
  -p, --port <number>  Port number (default: 8081)
  -h, --host <string>  Host address (default: localhost)
  --help               Show this help message
`);
        process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const wsUrl = `ws://${options.host || 'localhost'}:${options.port || 8081}/rozenite-mcp`;
  // eslint-disable-next-line prefer-const -- tools is reassigned when receiving tools/list messages
  let registry: {
    tools: MCPTool[];
  } = {
    tools: [
      {
        name: 'lorem-ipsum',
        description: 'Generate a random Lorem Ipsum text',
        inputSchema: {
          type: 'object',
          properties: {
            length: { type: 'number' },
          },
        },
      }
    ],
  }

  const server = new McpServer(
    {
      name: 'rozenite-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
    },
  );

  let ws: WebSocket | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  const pendingCalls = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }
  >();

  const rejectPendingCalls = (reason: Error) => {
    for (const [id, pending] of pendingCalls.entries()) {
      pendingCalls.delete(id);
      pending.reject(reason);
    }
  };

  // Set up ListToolsRequestSchema handler to return current tools
  server.server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: registry.tools };
  });

  // Set up CallToolRequestSchema handler to wrap tool call logic
  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    console.error('Will send tool call to', name, args);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'WebSocket not connected',
          },
        ],
        isError: true,
      };
    }

    const id = Math.random().toString(36).substring(7);
    const toolCall: CustomToolCall = {
      type: 'tool/call',
      id,
      name,
      arguments: args,
    };

    return new Promise((resolve, reject) => {
      pendingCalls.set(id, {
        resolve: (result) => {
          resolve({
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          });
        },
        reject: (error) => {
          resolve({
            content: [
              {
                type: 'text' as const,
                text:
                  typeof error === 'string'
                    ? error
                    : JSON.stringify(error),
              },
            ],
            isError: true,
          });
        },
      });

      ws!.send(JSON.stringify(toolCall));
      console.error('Sent tool call to', name, args);
    });
  });

  const connect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.error(`[rozenite-mcp] Connected to ${wsUrl}`);
    });

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString()) as CustomMessage;

        if (message.type === 'tools/list') {
          // Update tools array instead of calling registerTool
          registry.tools = message.tools;
          console.error(JSON.stringify(registry.tools, null, 2));
          server.sendToolListChanged();
          // console.error(JSON.stringify(message.tools, null, 2));
          // The MCP SDK will automatically notify clients about tool changes
          // when listChanged: true capability is enabled
        } else if (message.type === 'tool/result') {
          const pending = pendingCalls.get(message.id);
          if (pending) {
            pendingCalls.delete(message.id);
            if (message.error) {
              pending.reject(new Error(message.error));
            } else {
              pending.resolve(message.result);
            }
          }
        }
      } catch (error) {
        console.error('[rozenite-mcp] Failed to parse message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error(`[rozenite-mcp] WebSocket error:`, error);
    });

    ws.on('close', () => {
      console.error(`[rozenite-mcp] WebSocket closed, reconnecting...`);
      rejectPendingCalls(new Error('WebSocket disconnected'));
      reconnectTimer = setTimeout(() => {
        connect();
      }, 1000);
    });
  };

  connect();
  const transport = new StdioServerTransport();
  server.connect(transport);
  console.error('[rozenite-mcp] MCP server running on stdio');
}

main().catch((error) => {
  console.error('[rozenite-mcp] Fatal error:', error);
  process.exit(1);
});
