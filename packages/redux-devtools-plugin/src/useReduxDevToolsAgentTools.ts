import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import {
  commitCurrentStateTool,
  dispatchActionTool,
  getActionDetailsTool,
  getReduxActionDetailsResult,
  getReduxStoreStateResult,
  getStoreStateTool,
  jumpToActionTool,
  jumpToReduxActionResult,
  listActionsTool,
  listReduxActionsResult,
  listReduxDevToolsStoresResult,
  listStoresTool,
  resetHistoryTool,
  resetReduxHistoryResult,
  rollbackReduxStateResult,
  rollbackStateTool,
  setLockedTool,
  setReduxLockedResult,
  setReduxRecordingPausedResult,
  setRecordingPausedTool,
  sweepReduxSkippedActionsResult,
  sweepSkippedActionsTool,
  toggleActionTool,
  toggleReduxActionResult,
  dispatchReduxActionResult,
  commitReduxCurrentStateResult,
} from './redux-devtools-agent';
import { REDUX_DEVTOOLS_AGENT_PLUGIN_ID } from './shared/agent-tools';

export const useReduxDevToolsAgentTools = () => {
  useRozenitePluginAgentTool({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: listStoresTool,
    handler: () => listReduxDevToolsStoresResult(),
  });

  useRozenitePluginAgentTool({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: getStoreStateTool,
    handler: (input) => getReduxStoreStateResult(input),
  });

  useRozenitePluginAgentTool({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: listActionsTool,
    handler: (input) => listReduxActionsResult(input),
  });

  useRozenitePluginAgentTool({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: getActionDetailsTool,
    handler: (input) => getReduxActionDetailsResult(input),
  });

  useRozenitePluginAgentTool({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: dispatchActionTool,
    handler: (input) => dispatchReduxActionResult(input),
  });

  useRozenitePluginAgentTool({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: jumpToActionTool,
    handler: (input) => jumpToReduxActionResult(input),
  });

  useRozenitePluginAgentTool({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: toggleActionTool,
    handler: (input) => toggleReduxActionResult(input),
  });

  useRozenitePluginAgentTool({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: resetHistoryTool,
    handler: (input) => resetReduxHistoryResult(input),
  });

  useRozenitePluginAgentTool({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: rollbackStateTool,
    handler: (input) => rollbackReduxStateResult(input),
  });

  useRozenitePluginAgentTool({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: commitCurrentStateTool,
    handler: (input) => commitReduxCurrentStateResult(input),
  });

  useRozenitePluginAgentTool({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: sweepSkippedActionsTool,
    handler: (input) => sweepReduxSkippedActionsResult(input),
  });

  useRozenitePluginAgentTool({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: setRecordingPausedTool,
    handler: (input) => setReduxRecordingPausedResult(input),
  });

  useRozenitePluginAgentTool({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: setLockedTool,
    handler: (input) => setReduxLockedResult(input),
  });
};
