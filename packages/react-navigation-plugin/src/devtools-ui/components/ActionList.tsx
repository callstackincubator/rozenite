import { Surface } from '@rozenite/ui';
import type { ActionOrigin } from '../../react-native/symbolication/types';
import type { NavigationAction, NavigationState } from '../../shared';
import { ActionItem } from './ActionItem';

export type ActionWithState = {
  id?: number;
  action: NavigationAction;
  state: NavigationState | undefined;
  origin?: ActionOrigin;
};

export type ActionListProps = {
  actionHistory: ActionWithState[];
  selectedActionIndex: number | null;
  onActionSelect: (index: number) => void;
  onGoToAction: (index: number) => void;
};

export const ActionList = ({
  actionHistory,
  selectedActionIndex,
  onActionSelect,
  onGoToAction,
}: ActionListProps) => {
  return (
    <div className="h-full">
      {actionHistory.length === 0 ? (
        <Surface className="text-sm text-muted" variant="secondary">
          No actions recorded yet.
        </Surface>
      ) : (
        <div className="space-y-2 pb-1">
          {actionHistory.map((entry, index) => (
            <ActionItem
              key={index}
              action={entry.action}
              origin={entry.origin}
              index={index}
              isSelected={selectedActionIndex === index}
              onSelect={() => onActionSelect(index)}
              onGoToAction={() => onGoToAction(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
