import { formatFrameLocation } from '../../react-native/symbolication/format';
import type { ActionOrigin } from '../../react-native/symbolication/types';
import { NavigationAction } from '../../shared';

export type ActionItemProps = {
  action: NavigationAction;
  origin: ActionOrigin | undefined;
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
    SNAPSHOT: 'text-gray-400',
    '@@UNKNOWN': 'text-gray-400',
  };
  return colors[type] || 'text-gray-400';
};

// Show only the file basename in the sidebar — full path lives in the
// detail panel. Keeps each row to a single line in narrow widths.
const shortenForSidebar = (location: string): string => {
  const lastSlash = location.lastIndexOf('/');
  return lastSlash === -1 ? location : location.slice(lastSlash + 1);
};

const OriginPreview = ({ origin }: { origin: ActionOrigin | undefined }) => {
  if (!origin) return null;
  if (origin.symbolicationStatus === 'pending') {
    return (
      <div className="mt-1 text-xs italic text-gray-500">↳ Resolving…</div>
    );
  }
  if (origin.symbolicationStatus !== 'complete') return null;
  if (origin.confidence === 'none') return null;
  const location = formatFrameLocation(origin.originFrame);
  if (!location) return null;
  return (
    <div
      className={`mt-1 truncate font-mono text-xs text-gray-500 ${
        origin.confidence === 'low' ? 'italic' : ''
      }`}
      title={location}
    >
      ↳ {shortenForSidebar(location)}
    </div>
  );
};

export const ActionItem = ({
  action,
  origin,
  index,
  isSelected,
  onSelect,
  onGoToAction,
}: ActionItemProps) => {
  const actionName =
    !!action.payload &&
    'name' in action.payload &&
    typeof action.payload.name === 'string'
      ? action.payload.name
      : undefined;

  return (
    <div
      className={`m-1 p-3 rounded cursor-pointer transition-all duration-200 border overflow-hidden ${
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

      {actionName && (
        <div className="text-xs text-gray-300">→ {actionName}</div>
      )}

      <OriginPreview origin={origin} />
    </div>
  );
};
