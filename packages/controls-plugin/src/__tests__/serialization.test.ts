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
            onToggle: vi.fn(),
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
            onSelect: vi.fn(),
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
        ],
      },
    ]);
  });

  it('builds an action registry for interactive items', async () => {
    const onToggle = vi.fn();
    const onPress = vi.fn();
    const onSelect = vi.fn();

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
            onToggle,
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
            onSelect,
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

    expect(toggleEntry?.type).toBe('toggle');
    expect(buttonEntry?.type).toBe('button');
    expect(selectEntry?.type).toBe('select');

    if (toggleEntry?.type === 'toggle') {
      await toggleEntry.onToggle(true);
    }

    if (buttonEntry?.type === 'button') {
      await buttonEntry.onPress();
    }

    if (selectEntry?.type === 'select') {
      await selectEntry.onSelect('staging');
    }

    expect(onToggle).toHaveBeenCalledWith(true);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('staging');
  });
});
