import { Button, Card, Chip } from '@rozenite/ui';
import { ActionList } from './ActionList';
import type { ActionWithState } from './ActionList';

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
    <Card className="flex min-h-0 w-80 shrink-0 flex-col xl:w-[21rem]">
      <Card.Header>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Card.Title>Timeline</Card.Title>
            <Card.Description className="mt-1 text-xs">
              Newest navigation actions appear first.
            </Card.Description>
          </div>
          <Chip className="shrink-0" size="sm" variant="secondary">
            {actionHistory.length}
          </Chip>
        </div>
      </Card.Header>

      <Card.Content className="flex min-h-0 flex-1 flex-col gap-3">
        <Button
          isDisabled={actionHistory.length === 0}
          onPress={onClearActions}
          size="sm"
          variant="secondary"
        >
          Clear actions
        </Button>

        <div className="min-h-0 flex-1 overflow-auto">
          <ActionList
            actionHistory={actionHistory}
            selectedActionIndex={selectedActionIndex}
            onActionSelect={onActionSelect}
            onGoToAction={onGoToAction}
          />
        </div>
      </Card.Content>
    </Card>
  );
};
