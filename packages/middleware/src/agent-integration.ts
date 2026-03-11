import { createAgentMessageHandler } from './agent/handler.js';

const agentHandler = createAgentMessageHandler();

export const getAgentHandler = () => {
  return agentHandler;
};
