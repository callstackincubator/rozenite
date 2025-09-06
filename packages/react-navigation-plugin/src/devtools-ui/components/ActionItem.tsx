import { NavigationAction, NavigationState } from '../../shared';

export type ActionItemProps = {
  action: NavigationAction;
  state: NavigationState | undefined;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onGoToAction: () => void;
};

const getActionTypeColor = (type: string): string => {
  const colors: { [key: string]: string } = {
    NAVIGATE: 'text-green-400',
    GO_BACK: 'text-orange-400',
    PUSH: 'text-blue-400',
    POP: 'text-red-400',
    REPLACE: 'text-purple-400',
    RESET: 'text-yellow-600',
    SET_PARAMS: 'text-cyan-400',
  };
  return colors[type] || 'text-gray-400';
};

export const ActionItem = ({
  action,
  state,
  index,
  isSelected,
  onSelect,
  onGoToAction,
}: ActionItemProps) => {
  return (
    <div
      className={`m-1 p-3 rounded cursor-pointer transition-all duration-200 border ${
        isSelected
          ? 'bg-blue-900/30 border-blue-500'
          : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`font-bold text-sm ${getActionTypeColor(action.type)}`}
          >
            {action.type}
          </span>
          <span className="text-xs text-gray-500">#{index}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onGoToAction();
          }}
          className="px-2 py-1 text-xs border border-blue-500 bg-blue-500 text-white hover:bg-blue-600 cursor-pointer rounded transition-colors duration-200"
        >
          Go to
        </button>
      </div>

      {action.payload && 'name' in action.payload && (
        <div className="text-xs text-gray-300">
          → {(action.payload as any).name}
        </div>
      )}
    </div>
  );
};
