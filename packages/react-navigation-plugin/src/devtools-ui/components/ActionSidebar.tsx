import { NavigationAction, NavigationState } from '../../shared';
import { ActionList, ActionWithState } from './ActionList';

export type ActionSidebarProps = {
  actionHistory: ActionWithState[];
  selectedActionIndex: number | null;
  onActionSelect: (index: number) => void;
  onGoToAction: (index: number) => void;
};

export const ActionSidebar = ({
  actionHistory,
  selectedActionIndex,
  onActionSelect,
  onGoToAction,
}: ActionSidebarProps) => {
  return (
    <div className="w-80 border-r border-gray-700 overflow-hidden bg-gray-900 flex flex-col">
      <ActionList
        actionHistory={actionHistory}
        selectedActionIndex={selectedActionIndex}
        onActionSelect={onActionSelect}
        onGoToAction={onGoToAction}
      />
    </div>
  );
};
