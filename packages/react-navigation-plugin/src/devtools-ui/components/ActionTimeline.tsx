import { ActionSidebar } from './ActionSidebar';
import { ActionDetailPanel } from './ActionDetailPanel';
import { ActionWithState } from './ActionList';
import { EmptyState, Split } from '@rozenite/ui';

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
  const selectedEntry = selectedActionIndex !== null ? actionHistory[selectedActionIndex] : null;

  return (
    <Split direction="horizontal" autoSaveId="react-navigation-timeline">
      <Split.Pane defaultSize={28} minSize={18} maxSize={45}>
        <ActionSidebar
          actionHistory={actionHistory}
          selectedActionIndex={selectedActionIndex}
          onActionSelect={onActionSelect}
          onGoToAction={onGoToAction}
          onClearActions={onClearActions}
        />
      </Split.Pane>
      <Split.Handle />
      <Split.Pane>
        {selectedEntry ? (
          <ActionDetailPanel
            key={selectedActionIndex}
            action={selectedEntry.action}
            state={selectedEntry.state}
            origin={selectedEntry.origin}
          />
        ) : (
          <EmptyState
            className="h-full"
            title="No action selected"
            description="Select an action from the timeline to inspect its details."
          />
        )}
      </Split.Pane>
    </Split>
  );
};
