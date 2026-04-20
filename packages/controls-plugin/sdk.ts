import { defineAgentToolDescriptors } from '@rozenite/agent-shared';
import {
  CONTROLS_AGENT_PLUGIN_ID,
  controlsToolDefinitions,
} from './src/shared/agent-tools.js';

export {
  CONTROLS_AGENT_PLUGIN_ID,
  controlsToolDefinitions,
};

export const controlsTools = defineAgentToolDescriptors(
  CONTROLS_AGENT_PLUGIN_ID,
  controlsToolDefinitions,
);

export type {
  ControlsGetItemArgs,
  ControlsGetItemResult,
  ControlsListSectionItemSummary,
  ControlsListSectionSummary,
  ControlsListSectionsArgs,
  ControlsListSectionsResult,
  ControlsPressButtonArgs,
  ControlsPressButtonResult,
  ControlsSectionItemArgs,
  ControlsSetValueArgs,
  ControlsSetValueResult,
} from './src/shared/agent-tools.js';

export type {
  ControlsButtonItemSnapshot,
  ControlsInputItemSnapshot,
  ControlsItemSnapshot,
  ControlsSectionSnapshot,
  ControlsSelectItemSnapshot,
  ControlsSelectOption,
  ControlsTextItemSnapshot,
  ControlsToggleItemSnapshot,
} from './src/shared/types.js';
