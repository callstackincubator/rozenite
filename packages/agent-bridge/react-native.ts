export type {
  UseRozeniteAgentToolOptions,
  UseRozenitePluginAgentToolOptions,
  UseRozeniteInAppAgentToolOptions,
} from './src/react-native/useRozeniteAgentTool';
export { definePaginatedAgentToolContract, isAgentToolPagination } from '@rozenite/agent-shared';
export type {
  JSONSchema7,
  AgentTool,
  AgentToolTraits,
  AgentToolPagination,
  PageEnvelope,
  PageResult,
  AgentMessage,
  AgentSessionReadyPayload,
  AgentSessionReadyMessage,
  RegisterToolMessage,
  UnregisterToolMessage,
  ToolCallMessage,
  ToolResultMessage,
} from './src/types';

export let useRozenitePluginAgentTool: typeof import('./src/react-native/useRozeniteAgentTool').useRozenitePluginAgentTool;
export let useRozeniteInAppAgentTool: typeof import('./src/react-native/useRozeniteAgentTool').useRozeniteInAppAgentTool;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isServer) {
  useRozenitePluginAgentTool =
    require('./src/react-native/useRozeniteAgentTool').useRozenitePluginAgentTool;
  useRozeniteInAppAgentTool =
    require('./src/react-native/useRozeniteAgentTool').useRozeniteInAppAgentTool;
} else {
  useRozenitePluginAgentTool = () => {};
  useRozeniteInAppAgentTool = () => {};
}
