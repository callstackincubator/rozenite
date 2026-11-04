import { defineAgentToolDescriptors } from '@rozenite/agent-shared';
import { ZUSTAND_AGENT_PLUGIN_ID, zustandAgentToolDefinitions } from './src/shared/agent-tools.js';

export { ZUSTAND_AGENT_PLUGIN_ID, zustandAgentToolDefinitions };

export const zustandTools = defineAgentToolDescriptors(
  ZUSTAND_AGENT_PLUGIN_ID,
  zustandAgentToolDefinitions,
);

export type {
  ZustandAgentApplyResult,
  ZustandAgentGetStateArgs,
  ZustandAgentGetStateResult,
  ZustandAgentGetTransitionArgs,
  ZustandAgentGetTransitionResult,
  ZustandAgentInvokeActionArgs,
  ZustandAgentInvokeActionResult,
  ZustandAgentJumpArgs,
  ZustandAgentListStoresResult,
  ZustandAgentListTransitionsArgs,
  ZustandAgentListTransitionsResult,
  ZustandAgentSetFlagArgs,
  ZustandAgentSetValueArgs,
  ZustandAgentStoreInput,
  ZustandAgentStoreSummary,
  ZustandAgentTransitionSummary,
} from './src/shared/agent-tools.js';
