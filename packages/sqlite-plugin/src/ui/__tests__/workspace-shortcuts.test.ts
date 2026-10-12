import { describe, expect, it, vi } from 'vitest';
import { handleWorkspaceShortcut, type WorkspaceShortcutEvent } from '../workspace-shortcuts';

const press = (key: string, overrides: Partial<WorkspaceShortcutEvent> = {}) => {
  const event: WorkspaceShortcutEvent = {
    key,
    metaKey: true,
    ctrlKey: false,
    defaultPrevented: false,
    preventDefault: vi.fn(),
    ...overrides,
  };
  const handlers = { activeTab: 'query', focusObjectSearch: vi.fn(), saveQuery: vi.fn() };

  return { event, handlers, run: () => handleWorkspaceShortcut(event, handlers) };
};

describe('handleWorkspaceShortcut', () => {
  it('saves the query once on Cmd/Ctrl+S in the Query tab', () => {
    const { event, handlers, run } = press('s');

    run();

    expect(handlers.saveQuery).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it('does not save again when the editor already handled the key', () => {
    const { handlers, run } = press('s', { defaultPrevented: true });

    run();

    expect(handlers.saveQuery).not.toHaveBeenCalled();
  });

  it('ignores Cmd/Ctrl+S outside the Query tab and keys without a modifier', () => {
    const otherTab = press('s');
    otherTab.handlers.activeTab = 'data';
    otherTab.run();
    expect(otherTab.handlers.saveQuery).not.toHaveBeenCalled();

    const plain = press('s', { metaKey: false });
    plain.run();
    expect(plain.handlers.saveQuery).not.toHaveBeenCalled();
  });

  it('focuses the explorer filter on Cmd/Ctrl+P from any tab', () => {
    const { handlers, run } = press('P', { metaKey: false, ctrlKey: true });
    handlers.activeTab = 'structure';

    run();

    expect(handlers.focusObjectSearch).toHaveBeenCalledOnce();
  });
});
