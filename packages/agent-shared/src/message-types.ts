/**
 * Wire-level `type` strings of the agent message protocol, spoken between a
 * device (`@rozenite/agent-bridge`) and the middleware. Keep in sync with the
 * message types in `index.ts`, which are derived from these.
 */
export const AGENT_MESSAGE_TYPES = {
  registerTool: 'register-tool',
  unregisterTool: 'unregister-tool',
  toolCall: 'tool-call',
  toolResult: 'tool-result',
  agentSessionReady: 'agent-session-ready',
} as const;
