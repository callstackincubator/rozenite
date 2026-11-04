import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import {
  ZUSTAND_AGENT_PLUGIN_ID,
  zustandAgentToolDefinitions as tools,
} from '../shared/agent-tools';
import {
  getStateResult,
  getTransitionResult,
  invokeActionResult,
  jumpToTransitionResult,
  listStoresResult,
  listTransitionsResult,
  setRecordingResult,
  setValueResult,
} from './agent-tools';

/**
 * Exposes every registered Zustand store to Rozenite for Agents: read state
 * and history, call actions, edit values, time travel and pause recording.
 */
export const useZustandAgentTools = () => {
  const pluginId = ZUSTAND_AGENT_PLUGIN_ID;
  useRozenitePluginAgentTool({
    pluginId,
    tool: tools.listStores,
    handler: () => listStoresResult(),
  });
  useRozenitePluginAgentTool({
    pluginId,
    tool: tools.getState,
    handler: (input) => getStateResult(input),
  });
  useRozenitePluginAgentTool({
    pluginId,
    tool: tools.listTransitions,
    handler: (input) => listTransitionsResult(input),
  });
  useRozenitePluginAgentTool({
    pluginId,
    tool: tools.getTransition,
    handler: (input) => getTransitionResult(input),
  });
  useRozenitePluginAgentTool({
    pluginId,
    tool: tools.invokeAction,
    handler: (input) => invokeActionResult(input),
  });
  useRozenitePluginAgentTool({
    pluginId,
    tool: tools.setValue,
    handler: (input) => setValueResult(input),
  });
  useRozenitePluginAgentTool({
    pluginId,
    tool: tools.jumpToTransition,
    handler: (input) => jumpToTransitionResult(input),
  });
  useRozenitePluginAgentTool({
    pluginId,
    tool: tools.setRecording,
    handler: (input) => setRecordingResult(input),
  });
};
