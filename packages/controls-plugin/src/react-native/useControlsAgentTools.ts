import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';
import {
  CONTROLS_AGENT_PLUGIN_ID,
  controlsToolDefinitions,
} from '../shared/agent-tools';
import type { ControlsSection } from '../shared/types';

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
    pluginId: CONTROLS_AGENT_PLUGIN_ID,
    tool: controlsToolDefinitions.listSections,
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

  useRozenitePluginAgentTool({
    pluginId: CONTROLS_AGENT_PLUGIN_ID,
    tool: controlsToolDefinitions.getItem,
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

  useRozenitePluginAgentTool({
    pluginId: CONTROLS_AGENT_PLUGIN_ID,
    tool: controlsToolDefinitions.setValue,
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
        return { applied: true as const, sectionId, itemId };
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
      return { applied: true as const, sectionId, itemId };
    },
  });

  useRozenitePluginAgentTool({
    pluginId: CONTROLS_AGENT_PLUGIN_ID,
    tool: controlsToolDefinitions.pressButton,
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
      return { pressed: true as const, sectionId, itemId };
    },
  });
};
