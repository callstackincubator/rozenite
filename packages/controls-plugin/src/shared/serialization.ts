import type {
  ControlsButtonItem,
  ControlsItem,
  ControlsItemSnapshot,
  ControlsSelectItem,
  ControlsSection,
  ControlsSectionSnapshot,
  ControlsToggleItem,
} from './types';

export type ActionRegistryEntry =
  | {
      type: 'toggle';
      onToggle: ControlsToggleItem['onToggle'];
    }
  | {
      type: 'button';
      onPress: ControlsButtonItem['onPress'];
    }
  | {
      type: 'select';
      onSelect: ControlsSelectItem['onSelect'];
    };

const toSnapshotItem = (item: ControlsItem): ControlsItemSnapshot => {
  if (item.type === 'text') {
    return item;
  }

  if (item.type === 'toggle') {
    const { onToggle: _onToggle, ...snapshot } = item;
    return snapshot;
  }

  if (item.type === 'button') {
    const { onPress: _onPress, ...snapshot } = item;
    return snapshot;
  }

  const { onSelect: _onSelect, ...snapshot } = item;
  return snapshot;
};

export const serializeSections = (
  sections: ControlsSection[]
): ControlsSectionSnapshot[] =>
  sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    items: section.items.map(toSnapshotItem),
  }));

export const buildActionRegistry = (sections: ControlsSection[]) => {
  const registry = new Map<string, ActionRegistryEntry>();

  sections.forEach((section) => {
    section.items.forEach((item) => {
      const key = `${section.id}:${item.id}`;

      if (item.type === 'toggle') {
        registry.set(key, {
          type: 'toggle',
          onToggle: item.onToggle,
        });
      }

      if (item.type === 'button') {
        registry.set(key, {
          type: 'button',
          onPress: item.onPress,
        });
      }

      if (item.type === 'select') {
        registry.set(key, {
          type: 'select',
          onSelect: item.onSelect,
        });
      }
    });
  });

  return registry;
};

export const getActionRegistryKey = (sectionId: string, itemId: string) =>
  `${sectionId}:${itemId}`;
