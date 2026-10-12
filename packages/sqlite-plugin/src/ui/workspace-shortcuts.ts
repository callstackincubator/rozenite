export type WorkspaceShortcutEvent = Pick<
  KeyboardEvent,
  'defaultPrevented' | 'metaKey' | 'ctrlKey' | 'key' | 'preventDefault'
>;

type WorkspaceShortcutHandlers = {
  activeTab: string;
  focusObjectSearch: () => void;
  saveQuery: () => void;
};

/**
 * Panel-wide shortcuts: Cmd/Ctrl+P focuses the explorer filter, Cmd/Ctrl+S saves the query on
 * the Query tab. A key the editor already handled (and so prevented) is not handled twice.
 */
export const handleWorkspaceShortcut = (
  event: WorkspaceShortcutEvent,
  { activeTab, focusObjectSearch, saveQuery }: WorkspaceShortcutHandlers,
) => {
  if (event.defaultPrevented || !(event.metaKey || event.ctrlKey)) {
    return;
  }

  const key = event.key.toLowerCase();

  if (key === 'p') {
    event.preventDefault();
    focusObjectSearch();
  } else if (key === 's' && activeTab === 'query') {
    event.preventDefault();
    saveQuery();
  }
};
