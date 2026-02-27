import { createMCPMessageHandler } from './mcp/handler.js';

const mcpHandler = createMCPMessageHandler();

export const getMCPHandler = () => {
  return mcpHandler;
};
