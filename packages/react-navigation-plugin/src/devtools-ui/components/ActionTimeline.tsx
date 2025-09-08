import { ActionSidebar } from './ActionSidebar';
import { ActionDetailPanel } from './ActionDetailPanel';
import { ActionWithState } from './ActionList';

export type ActionTimelineProps = {
  actionHistory: ActionWithState[];
  selectedActionIndex: number | null;
  onActionSelect: (index: number) => void;
  onGoToAction: (index: number) => void;
  onClearActions: () => void;
};

export const ActionTimeline = ({
  actionHistory,
  selectedActionIndex,
  onActionSelect,
  onGoToAction,
  onClearActions,
}: ActionTimelineProps) => {
  const selectedEntry =
    selectedActionIndex !== null ? actionHistory[selectedActionIndex] : null;

  return (
    <div className="h-full bg-gray-900 text-gray-100 flex">
      <ActionSidebar
        actionHistory={actionHistory}
        selectedActionIndex={selectedActionIndex}
        onActionSelect={onActionSelect}
        onGoToAction={onGoToAction}
        onClearActions={onClearActions}
      />

      {selectedEntry ? (
        <ActionDetailPanel
          action={selectedEntry.action}
          state={selectedEntry.state}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-900">
          Select an action from the timeline to view its details
        </div>
      )}
    </div>
  );
};
