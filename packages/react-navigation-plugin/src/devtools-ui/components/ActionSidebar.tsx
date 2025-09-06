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
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <h2 className="m-0 text-base font-bold text-gray-100">
          Action Timeline
        </h2>
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
