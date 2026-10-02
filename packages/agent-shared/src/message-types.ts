/**
 * Wire-level `type` strings of the agent message protocol, spoken between a
 * device (`@rozenite/agent-bridge`) and the middleware. The message types in
 * `index.ts` are derived from these.
 */
export const AGENT_MESSAGE_TYPES = {
  registerTool: 'register-tool',
  unregisterTool: 'unregister-tool',
  toolCall: 'tool-call',
  toolResult: 'tool-result',
  agentSessionReady: 'agent-session-ready',
} as const;
