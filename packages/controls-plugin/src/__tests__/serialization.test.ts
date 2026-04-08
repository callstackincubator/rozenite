import { describe, expect, it, vi } from 'vitest';
import { buildActionRegistry, getActionRegistryKey, serializeSections } from '../shared/serialization';
import { createSection } from '../shared/types';

describe('controls serialization', () => {
  it('omits callbacks from snapshots', () => {
    const sections = [
      createSection({
        id: 'diagnostics',
        title: 'Diagnostics',
        items: [
          {
            id: 'status',
            type: 'text',
            title: 'Status',
            value: 'ready',
          },
          {
            id: 'enabled',
            type: 'toggle',
            title: 'Enabled',
            value: true,
            validate: vi.fn(() => ({ valid: true as const })),
            onUpdate: vi.fn(),
          },
          {
            id: 'reset',
            type: 'button',
            title: 'Reset',
            onPress: vi.fn(),
          },
          {
            id: 'environment',
            type: 'select',
            title: 'Environment',
            value: 'staging',
            options: [
              { label: 'Local', value: 'local' },
              { label: 'Staging', value: 'staging' },
            ],
            validate: vi.fn(() => ({ valid: true as const })),
            onUpdate: vi.fn(),
          },
          {
            id: 'release-label',
            type: 'input',
            title: 'Release Label',
            value: 'build-001',
            placeholder: 'build-001',
            applyLabel: 'Apply',
            validate: vi.fn(() => ({ valid: true as const })),
            onUpdate: vi.fn(),
          },
        ],
      }),
    ];

    expect(serializeSections(sections)).toEqual([
      {
        id: 'diagnostics',
        title: 'Diagnostics',
        description: undefined,
        items: [
          {
            id: 'status',
            type: 'text',
            title: 'Status',
            value: 'ready',
          },
          {
            id: 'enabled',
            type: 'toggle',
            title: 'Enabled',
            value: true,
            description: undefined,
            disabled: undefined,
          },
          {
            id: 'reset',
            type: 'button',
            title: 'Reset',
            actionLabel: undefined,
            description: undefined,
            disabled: undefined,
          },
          {
            id: 'environment',
            type: 'select',
            title: 'Environment',
            value: 'staging',
            options: [
              { label: 'Local', value: 'local' },
              { label: 'Staging', value: 'staging' },
            ],
            description: undefined,
            disabled: undefined,
          },
          {
            id: 'release-label',
            type: 'input',
            title: 'Release Label',
            value: 'build-001',
            placeholder: 'build-001',
            applyLabel: 'Apply',
            description: undefined,
            disabled: undefined,
          },
        ],
      },
    ]);
  });

  it('builds an action registry for interactive items', async () => {
    const onUpdateToggle = vi.fn();
    const onPress = vi.fn();
    const onUpdateSelect = vi.fn();
    const onUpdateInput = vi.fn();
    const validateToggle = vi.fn(() => ({ valid: true as const }));
    const validateSelect = vi.fn(() => ({ valid: true as const }));
    const validateInput = vi.fn(() => ({ valid: true as const }));

    const sections = [
      createSection({
        id: 'controls',
        title: 'Controls',
        items: [
          {
            id: 'flag',
            type: 'toggle',
            title: 'Flag',
            value: false,
            validate: validateToggle,
            onUpdate: onUpdateToggle,
          },
          {
            id: 'refresh',
            type: 'button',
            title: 'Refresh',
            onPress,
          },
          {
            id: 'environment',
            type: 'select',
            title: 'Environment',
            value: 'local',
            options: [
              { label: 'Local', value: 'local' },
              { label: 'Staging', value: 'staging' },
            ],
            validate: validateSelect,
            onUpdate: onUpdateSelect,
          },
          {
            id: 'release-label',
            type: 'input',
            title: 'Release Label',
            value: 'build-001',
            placeholder: 'build-001',
            applyLabel: 'Apply',
            validate: validateInput,
            onUpdate: onUpdateInput,
          },
        ],
      }),
    ];

    const registry = buildActionRegistry(sections);

    const toggleEntry = registry.get(getActionRegistryKey('controls', 'flag'));
    const buttonEntry = registry.get(getActionRegistryKey('controls', 'refresh'));
    const selectEntry = registry.get(
      getActionRegistryKey('controls', 'environment')
    );
    const inputEntry = registry.get(
      getActionRegistryKey('controls', 'release-label')
    );

    expect(toggleEntry?.type).toBe('toggle');
    expect(buttonEntry?.type).toBe('button');
    expect(selectEntry?.type).toBe('select');
    expect(inputEntry?.type).toBe('input');

    if (toggleEntry?.type === 'toggle') {
      expect(toggleEntry.validate?.(true)).toEqual({ valid: true });
      await toggleEntry.onUpdate(true);
    }

    if (buttonEntry?.type === 'button') {
      await buttonEntry.onPress();
    }

    if (selectEntry?.type === 'select') {
      expect(selectEntry.validate?.('staging')).toEqual({ valid: true });
      await selectEntry.onUpdate('staging');
    }

    if (inputEntry?.type === 'input') {
      expect(inputEntry.validate?.('build-002')).toEqual({ valid: true });
      await inputEntry.onUpdate('build-002');
    }

    expect(validateToggle).toHaveBeenCalledWith(true);
    expect(onUpdateToggle).toHaveBeenCalledWith(true);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(validateSelect).toHaveBeenCalledWith('staging');
    expect(onUpdateSelect).toHaveBeenCalledWith('staging');
    expect(validateInput).toHaveBeenCalledWith('build-002');
    expect(onUpdateInput).toHaveBeenCalledWith('build-002');
  });
});
