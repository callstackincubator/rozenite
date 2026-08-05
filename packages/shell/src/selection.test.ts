import { describe, expect, it } from 'vitest';
import { getInitialSelection } from './selection';

describe('getInitialSelection', () => {
  it('selects the first plugin that exposes a panel', () => {
    expect(
      getInitialSelection([
        { id: 'empty', name: 'Empty', description: '', panels: [] },
        {
          id: 'storage',
          name: 'Storage',
          description: '',
          panels: [{ id: 'storage:table', name: 'Table', source: '/table' }],
        },
      ]),
    ).toEqual({ pluginId: 'storage', panelId: 'storage:table' });
  });

  it('returns null when no plugin has a panel', () => {
    expect(getInitialSelection([])).toBeNull();
  });
});
