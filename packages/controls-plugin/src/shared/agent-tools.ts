import {
  defineAgentToolContract,
  type AgentToolContract,
} from '@rozenite/agent-shared';
import type {
  ControlsItem,
  ControlsItemSnapshot,
} from './types';

export const CONTROLS_AGENT_PLUGIN_ID = '@rozenite/controls-plugin';

export type ControlsSectionItemArgs = {
  sectionId: string;
  itemId: string;
};

export type ControlsListSectionsArgs = undefined;

export type ControlsListSectionItemSummary = {
  id: string;
  type: ControlsItem['type'];
  title: string;
  disabled?: boolean;
};

export type ControlsListSectionSummary = {
  id: string;
  title: string;
  description?: string;
  items: ControlsListSectionItemSummary[];
};

export type ControlsListSectionsResult = {
  sections: ControlsListSectionSummary[];
};

export type ControlsGetItemArgs = ControlsSectionItemArgs;

export type ControlsGetItemResult = {
  sectionId: string;
  item: ControlsItemSnapshot;
};

export type ControlsSetValueArgs = ControlsSectionItemArgs & {
  value: boolean | string;
};

export type ControlsSetValueResult = {
  applied: true;
  sectionId: string;
  itemId: string;
};

export type ControlsPressButtonArgs = ControlsSectionItemArgs;

export type ControlsPressButtonResult = {
  pressed: true;
  sectionId: string;
  itemId: string;
};

export const controlsToolDefinitions = {
  listSections: defineAgentToolContract<
    ControlsListSectionsArgs,
    ControlsListSectionsResult
  >({
    name: 'list-sections',
    description:
      'List all controls sections with their item IDs, types, and titles. Does not include values — call get-item for that.',
    inputSchema: { type: 'object', properties: {} },
  }),
  getItem: defineAgentToolContract<ControlsGetItemArgs, ControlsGetItemResult>({
    name: 'get-item',
    description:
      'Get full details of a single controls item including its current value. For select items this includes available options.',
    inputSchema: {
      type: 'object',
      properties: {
        sectionId: { type: 'string', description: 'Section ID.' },
        itemId: { type: 'string', description: 'Item ID.' },
      },
      required: ['sectionId', 'itemId'],
    },
  }),
  setValue: defineAgentToolContract<
    ControlsSetValueArgs,
    ControlsSetValueResult
  >({
    name: 'set-value',
    description:
      'Update the value of a toggle, select, or input item. Runs the validate callback when present. Fails for text (read-only) and button items.',
    inputSchema: {
      type: 'object',
      properties: {
        sectionId: { type: 'string', description: 'Section ID.' },
        itemId: { type: 'string', description: 'Item ID.' },
        value: {
          description:
            'New value. Boolean for toggle items, string for select/input items.',
        },
      },
      required: ['sectionId', 'itemId', 'value'],
    },
  }),
  pressButton: defineAgentToolContract<
    ControlsPressButtonArgs,
    ControlsPressButtonResult
  >({
    name: 'press-button',
    description:
      "Trigger a button item's action. Fails if the item is not a button or is disabled.",
    inputSchema: {
      type: 'object',
      properties: {
        sectionId: { type: 'string', description: 'Section ID.' },
        itemId: { type: 'string', description: 'Item ID.' },
      },
      required: ['sectionId', 'itemId'],
    },
  }),
} as const satisfies Record<string, AgentToolContract<unknown, unknown>>;
