import { describe, expect, it, vi } from 'vitest';
import { createControlsRegistry } from '../controlsRegistry';
import type { ControlsSection } from '../../shared/types';

const section = (id: string): ControlsSection => ({
  id,
  title: id,
  items: [],
});

describe('controlsRegistry', () => {
  it('combines section registrations in registration order', () => {
    const registry = createControlsRegistry();
    const first = Symbol('first');
    const second = Symbol('second');

    registry.set(first, { sections: [section('app')] });
    registry.set(second, { sections: [section('locale')] });

    expect(registry.getOptions().sections.map(({ id }) => id)).toEqual([
      'app',
      'locale',
    ]);
  });

  it('lets updater registrations derive from previous options', () => {
    const registry = createControlsRegistry();
    const first = Symbol('first');
    const second = Symbol('second');

    registry.set(first, { sections: [section('app')] });
    registry.set(second, (previousOptions) => ({
      sections: [...previousOptions.sections, section('locale')],
    }));

    expect(registry.getOptions().sections.map(({ id }) => id)).toEqual([
      'app',
      'locale',
    ]);
  });

  it('lets updater registrations replace previous options when needed', () => {
    const registry = createControlsRegistry();
    const first = Symbol('first');
    const second = Symbol('second');

    registry.set(first, { sections: [section('app')] });
    registry.set(second, () => ({
      sections: [section('replacement')],
    }));

    expect(registry.getOptions().sections.map(({ id }) => id)).toEqual([
      'replacement',
    ]);
  });

  it('can include the current render input before the effect registers it', () => {
    const registry = createControlsRegistry();
    const id = Symbol('pending');

    expect(
      registry
        .getOptions({ id, input: { sections: [section('pending')] } })
        .sections.map((registeredSection) => registeredSection.id),
    ).toEqual(['pending']);
    expect(registry.isOwner(id, { id, input: { sections: [] } })).toBe(true);
  });

  it('notifies subscribers when ownership changes or registrations are removed', () => {
    const registry = createControlsRegistry();
    const listener = vi.fn();
    const first = Symbol('first');
    const second = Symbol('second');

    registry.subscribe(listener);
    expect(registry.getSnapshot()).toBe(0);

    registry.set(first, { sections: [section('app')] });
    expect(registry.getSnapshot()).toBe(1);

    registry.set(second, { sections: [section('locale')] });
    expect(registry.getSnapshot()).toBe(1);

    registry.delete(second);
    expect(registry.getSnapshot()).toBe(2);

    registry.delete(first);
    expect(registry.getSnapshot()).toBe(3);

    expect(listener).toHaveBeenCalledTimes(3);
  });
});
