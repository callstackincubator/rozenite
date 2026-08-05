import { ActionList, ActionWithState } from './ActionList';

export type ActionSidebarProps = {
  actionHistory: ActionWithState[];
  selectedActionIndex: number | null;
  onActionSelect: (index: number) => void;
  onGoToAction: (index: number) => void;
  onClearActions: () => void;
};

export const ActionSidebar = ({
  actionHistory,
  selectedActionIndex,
  onActionSelect,
  onGoToAction,
  onClearActions,
}: ActionSidebarProps) => {
  return (
    <div className="w-80 border-r border-gray-700 overflow-hidden bg-gray-900 flex flex-col">
      <div className="p-3 border-b border-gray-700">
        <button
          onClick={onClearActions}
          className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
          title="Clear all actions and request initial state"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Clear Actions
        </button>
      </div>
      <ActionList
        actionHistory={actionHistory}
        selectedActionIndex={selectedActionIndex}
        onActionSelect={onActionSelect}
        onGoToAction={onGoToAction}
      />
    </div>
  );
};
