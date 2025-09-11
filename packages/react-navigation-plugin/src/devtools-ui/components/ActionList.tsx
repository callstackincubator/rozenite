import { NavigationAction, NavigationState } from '../../shared';
import { ActionItem } from './ActionItem';

export type ActionWithState = {
  action: NavigationAction;
  state: NavigationState | undefined;
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
    <div className="flex-1 overflow-auto">
      {actionHistory.length === 0 ? (
        <div className="p-4 text-center text-gray-400">
          No actions recorded yet
        </div>
      ) : (
        <div className="p-2">
          {actionHistory.map((entry, index) => (
            <ActionItem
              key={index}
              action={entry.action}
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
