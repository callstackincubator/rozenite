import { defineAgentToolDescriptors } from '@rozenite/agent-shared';
import {
  REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
  reduxDevToolsToolDefinitions,
} from './src/shared/agent-tools.js';

export {
  REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
  reduxDevToolsToolDefinitions,
};

export const reduxDevToolsTools = defineAgentToolDescriptors(
  REDUX_DEVTOOLS_AGENT_PLUGIN_ID,
  reduxDevToolsToolDefinitions,
);

export type {
  ReduxDevToolsActionInput,
  ReduxDevToolsActionSummary,
  ReduxDevToolsApplyStoreActionResult,
  ReduxDevToolsDispatchActionArgs,
  ReduxDevToolsDispatchActionInput,
  ReduxDevToolsDispatchActionResult,
  ReduxDevToolsGetActionDetailsArgs,
  ReduxDevToolsGetActionDetailsResult,
  ReduxDevToolsGetStoreStateArgs,
  ReduxDevToolsGetStoreStateResult,
  ReduxDevToolsListActionsArgs,
  ReduxDevToolsListActionsResult,
  ReduxDevToolsListStoresArgs,
  ReduxDevToolsListStoresResult,
  ReduxDevToolsPaginatedStoreInput,
  ReduxDevToolsSetLockedInput,
  ReduxDevToolsSetRecordingPausedInput,
  ReduxDevToolsStoreInput,
  ReduxDevToolsStoreSummary,
} from './src/shared/agent-tools.js';
