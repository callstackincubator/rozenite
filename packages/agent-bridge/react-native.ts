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

// Neither Lynx runtime has a `window`, so `typeof window` alone reported
// every Lynx app as a server and installed the no-op stub below. `lynx` is
// a free binding in module scope, not a property of `globalThis`. Kept
// inline rather than imported so this stays a foldable expression and the
// `require`s below can still be dropped from production bundles.
declare const lynx: unknown;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined' && typeof lynx === 'undefined';

if (isDev && !isServer) {
  useRozenitePluginAgentTool =
    require('./src/react-native/useRozeniteAgentTool').useRozenitePluginAgentTool;
  useRozeniteInAppAgentTool =
    require('./src/react-native/useRozeniteAgentTool').useRozeniteInAppAgentTool;
} else {
  useRozenitePluginAgentTool = () => {};
  useRozeniteInAppAgentTool = () => {};
}
