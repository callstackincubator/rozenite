import { Card, Surface } from '@rozenite/ui';
import { ActionSidebar } from './ActionSidebar';
import { ActionDetailPanel } from './ActionDetailPanel';
import type { ActionWithState } from './ActionList';

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
    <div className="flex h-full min-h-0 w-full flex-1 gap-3">
      <ActionSidebar
        actionHistory={actionHistory}
        selectedActionIndex={selectedActionIndex}
        onActionSelect={onActionSelect}
        onGoToAction={onGoToAction}
        onClearActions={onClearActions}
      />

      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <Card.Header>
          <Card.Title>Action Details</Card.Title>
          <Card.Description className="mt-1 text-xs">
            {selectedEntry
              ? 'Inspect the selected action payload and its resulting navigation state.'
              : 'Select an action from the timeline to inspect its payload and navigation state.'}
          </Card.Description>
        </Card.Header>

        <Card.Content className="flex min-h-0 flex-1 flex-col">
          {selectedEntry ? (
            <ActionDetailPanel
              key={selectedActionIndex}
              action={selectedEntry.action}
              state={selectedEntry.state}
              origin={selectedEntry.origin}
            />
          ) : (
            <Surface
              className="flex flex-1 items-center justify-center text-sm text-muted"
              variant="secondary"
            >
              Select an action from the timeline to view its details.
            </Surface>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};
