import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import {
  commitCurrentStateTool,
  type ReduxDevToolsActionInput,
  type ReduxDevToolsDispatchActionInput,
  type ReduxDevToolsPaginatedStoreInput,
  type ReduxDevToolsStoreInput,
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
  REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
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

export const useReduxDevToolsAgentTools = () => {
  useRozenitePluginAgentTool({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: listStoresTool,
    handler: () => listReduxDevToolsStoresResult(),
  });

  useRozenitePluginAgentTool<ReduxDevToolsStoreInput>({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: getStoreStateTool,
    handler: (input) => getReduxStoreStateResult(input),
  });

  useRozenitePluginAgentTool<ReduxDevToolsPaginatedStoreInput>({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: listActionsTool,
    handler: (input) => listReduxActionsResult(input),
  });

  useRozenitePluginAgentTool<ReduxDevToolsActionInput>({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: getActionDetailsTool,
    handler: (input) => getReduxActionDetailsResult(input),
  });

  useRozenitePluginAgentTool<ReduxDevToolsDispatchActionInput>({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: dispatchActionTool,
    handler: (input) => dispatchReduxActionResult(input),
  });

  useRozenitePluginAgentTool<ReduxDevToolsActionInput>({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: jumpToActionTool,
    handler: (input) => jumpToReduxActionResult(input),
  });

  useRozenitePluginAgentTool<ReduxDevToolsActionInput>({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: toggleActionTool,
    handler: (input) => toggleReduxActionResult(input),
  });

  useRozenitePluginAgentTool<ReduxDevToolsStoreInput>({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: resetHistoryTool,
    handler: (input) => resetReduxHistoryResult(input),
  });

  useRozenitePluginAgentTool<ReduxDevToolsStoreInput>({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: rollbackStateTool,
    handler: (input) => rollbackReduxStateResult(input),
  });

  useRozenitePluginAgentTool<ReduxDevToolsStoreInput>({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: commitCurrentStateTool,
    handler: (input) => commitReduxCurrentStateResult(input),
  });

  useRozenitePluginAgentTool<ReduxDevToolsStoreInput>({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: sweepSkippedActionsTool,
    handler: (input) => sweepReduxSkippedActionsResult(input),
  });

  useRozenitePluginAgentTool<
    ReduxDevToolsStoreInput & { paused: boolean }
  >({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: setRecordingPausedTool,
    handler: (input) => setReduxRecordingPausedResult(input),
  });

  useRozenitePluginAgentTool<
    ReduxDevToolsStoreInput & { locked: boolean }
  >({
    pluginId: REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
    tool: setLockedTool,
    handler: (input) => setReduxLockedResult(input),
  });
};
