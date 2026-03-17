import { useRozenitePluginAgentTool, type AgentTool } from '@rozenite/agent-bridge';
import type { ControlsSection } from '../shared/types';

type SectionItemInput = {
  sectionId: string;
  itemId: string;
};

type SetValueInput = SectionItemInput & {
  value: boolean | string;
};

const pluginId = '@rozenite/controls-plugin';

const listSectionsTool: AgentTool = {
  name: 'list-sections',
  description:
    'List all controls sections with their item IDs, types, and titles. Does not include values — call get-item for that.',
  inputSchema: { type: 'object', properties: {} },
};

const getItemTool: AgentTool = {
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
};

const setValueTool: AgentTool = {
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
};

const pressButtonTool: AgentTool = {
  name: 'press-button',
  description: "Trigger a button item's action. Fails if the item is not a button or is disabled.",
  inputSchema: {
    type: 'object',
    properties: {
      sectionId: { type: 'string', description: 'Section ID.' },
      itemId: { type: 'string', description: 'Item ID.' },
    },
    required: ['sectionId', 'itemId'],
  },
};

const resolveItem = (
  sections: ControlsSection[],
  sectionId: string,
  itemId: string
) => {
  const section = sections.find((s) => s.id === sectionId);

  if (!section) {
    const available = sections.map((s) => s.id).join(', ');
    throw new Error(
      `Section "${sectionId}" not found. Available: ${available || '(none)'}`
    );
  }

  const item = section.items.find((i) => i.id === itemId);

  if (!item) {
    const available = section.items.map((i) => i.id).join(', ');
    throw new Error(
      `Item "${itemId}" not found in section "${sectionId}". Available: ${available || '(none)'}`
    );
  }

  return { section, item };
};

export const useControlsAgentTools = (sections: ControlsSection[]) => {
  useRozenitePluginAgentTool({
    pluginId,
    tool: listSectionsTool,
    handler: () => ({
      sections: sections.map((section) => ({
        id: section.id,
        title: section.title,
        description: section.description,
        items: section.items.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          disabled: 'disabled' in item ? item.disabled : undefined,
        })),
      })),
    }),
  });

  useRozenitePluginAgentTool<SectionItemInput>({
    pluginId,
    tool: getItemTool,
    handler: ({ sectionId, itemId }) => {
      const { item } = resolveItem(sections, sectionId, itemId);

      if (item.type === 'text') {
        return {
          sectionId,
          item: {
            id: item.id,
            type: item.type,
            title: item.title,
            value: item.value,
            description: item.description,
          },
        };
      }

      if (item.type === 'toggle') {
        return {
          sectionId,
          item: {
            id: item.id,
            type: item.type,
            title: item.title,
            value: item.value,
            description: item.description,
            disabled: item.disabled,
          },
        };
      }

      if (item.type === 'button') {
        return {
          sectionId,
          item: {
            id: item.id,
            type: item.type,
            title: item.title,
            actionLabel: item.actionLabel,
            description: item.description,
            disabled: item.disabled,
          },
        };
      }

      if (item.type === 'select') {
        return {
          sectionId,
          item: {
            id: item.id,
            type: item.type,
            title: item.title,
            value: item.value,
            options: item.options,
            description: item.description,
            disabled: item.disabled,
          },
        };
      }

      return {
        sectionId,
        item: {
          id: item.id,
          type: item.type,
          title: item.title,
          value: item.value,
          placeholder: item.placeholder,
          applyLabel: item.applyLabel,
          description: item.description,
          disabled: item.disabled,
        },
      };
    },
  });

  useRozenitePluginAgentTool<SetValueInput>({
    pluginId,
    tool: setValueTool,
    handler: async ({ sectionId, itemId, value }) => {
      const { item } = resolveItem(sections, sectionId, itemId);

      if (item.type === 'text') {
        throw new Error(
          `Item "${itemId}" is a read-only text item and cannot be updated.`
        );
      }

      if (item.type === 'button') {
        throw new Error(
          `Item "${itemId}" is a button. Use press-button to trigger its action.`
        );
      }

      if (item.disabled) {
        throw new Error(`Item "${itemId}" is disabled.`);
      }

      if (item.type === 'toggle') {
        if (typeof value !== 'boolean') {
          throw new Error(
            `Expected boolean value for toggle item "${itemId}".`
          );
        }

        if (item.validate) {
          const result = item.validate(value);
          if (!result.valid) {
            throw new Error(result.message);
          }
        }

        await item.onUpdate(value);
        return { applied: true, sectionId, itemId };
      }

      if (typeof value !== 'string') {
        throw new Error(
          `Expected string value for ${item.type} item "${itemId}".`
        );
      }

      if (item.type === 'select') {
        const validOptions = item.options.map((o) => o.value);
        if (!validOptions.includes(value)) {
          throw new Error(
            `Invalid option "${value}" for item "${itemId}". Valid options: ${validOptions.join(', ')}`
          );
        }
      }

      if (item.validate) {
        const result = item.validate(value);
        if (!result.valid) {
          throw new Error(result.message);
        }
      }

      await item.onUpdate(value);
      return { applied: true, sectionId, itemId };
    },
  });

  useRozenitePluginAgentTool<SectionItemInput>({
    pluginId,
    tool: pressButtonTool,
    handler: async ({ sectionId, itemId }) => {
      const { item } = resolveItem(sections, sectionId, itemId);

      if (item.type !== 'button') {
        throw new Error(
          `Item "${itemId}" is not a button (type: ${item.type}). Use set-value to update its value.`
        );
      }

      if (item.disabled) {
        throw new Error(`Button "${itemId}" is disabled.`);
      }

      await item.onPress();
      return { pressed: true, sectionId, itemId };
    },
  });
};
