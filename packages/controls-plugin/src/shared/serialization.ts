import type {
  ControlsButtonItem,
  ControlsItem,
  ControlsItemSnapshot,
  ControlsMutableItemBase,
  ControlsSelectItem,
  ControlsSection,
  ControlsSectionSnapshot,
  ControlsToggleItem,
  ControlsValidationResult,
} from './types';

export type ActionRegistryEntry =
  | {
      type: 'toggle';
      validate?: ControlsToggleItem['validate'];
      onUpdate: ControlsToggleItem['onUpdate'];
    }
  | {
      type: 'button';
      onPress: ControlsButtonItem['onPress'];
    }
  | {
      type: 'select';
      validate?: ControlsSelectItem['validate'];
      onUpdate: ControlsSelectItem['onUpdate'];
    };

const validateValue = <TValue>(
  validate: ControlsMutableItemBase<TValue>['validate'],
  value: TValue
): ControlsValidationResult => {
  if (!validate) {
    return { valid: true };
  }

  return validate(value);
};

const toSnapshotItem = (item: ControlsItem): ControlsItemSnapshot => {
  if (item.type === 'text') {
    return item;
  }

  if (item.type === 'toggle') {
    const { validate: _validate, onUpdate: _onUpdate, ...snapshot } = item;
    return snapshot;
  }

  if (item.type === 'button') {
    const { onPress: _onPress, ...snapshot } = item;
    return snapshot;
  }

  const { validate: _validate, onUpdate: _onUpdate, ...snapshot } = item;
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
          validate: item.validate,
          onUpdate: item.onUpdate,
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
          validate: item.validate,
          onUpdate: item.onUpdate,
        });
      }
    });
  });

  return registry;
};

export const getActionRegistryKey = (sectionId: string, itemId: string) =>
  `${sectionId}:${itemId}`;

export { validateValue };
