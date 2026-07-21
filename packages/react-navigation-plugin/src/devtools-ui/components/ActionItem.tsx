import { Button, Chip, Surface } from '@rozenite/ui';
import { formatFrameLocation } from '../../react-native/symbolication/format';
import type { ActionOrigin } from '../../react-native/symbolication/types';
import type { NavigationAction } from '../../shared';

export type ActionItemProps = {
  action: NavigationAction;
  origin: ActionOrigin | undefined;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onGoToAction: () => void;
};

const getActionTypeColor = (
  type: string
): 'success' | 'warning' | 'accent' | 'danger' | 'default' => {
  const colors: Record<
    string,
    'success' | 'warning' | 'accent' | 'danger' | 'default'
  > = {
    NAVIGATE: 'success',
    GO_BACK: 'warning',
    PUSH: 'accent',
    POP: 'danger',
    REPLACE: 'accent',
    RESET: 'warning',
    SET_PARAMS: 'default',
    SNAPSHOT: 'default',
    '@@UNKNOWN': 'default',
  };
  return colors[type] || 'default';
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
      className={`cursor-pointer rounded-lg transition-colors ${
        isSelected
          ? 'ring-1 ring-accent/25'
          : ''
      }`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <Surface
        className={`border px-3 py-3 transition-colors ${
          isSelected
            ? 'border-accent/60 bg-accent/10'
            : 'border-border/70 bg-surface-secondary hover:bg-surface-tertiary'
        }`}
        variant="secondary"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                color={getActionTypeColor(action.type)}
                size="sm"
                variant="soft"
              >
                {action.type}
              </Chip>
              <span className="text-xs text-muted">#{index}</span>
            </div>

            {actionName ? (
              <div className="mt-2 truncate text-sm text-foreground">
                {actionName}
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted">
                No route name attached to this action.
              </div>
            )}

            <OriginPreview origin={origin} />
          </div>

          <div
            className="shrink-0"
            onClick={(event) => event.stopPropagation()}
          >
            <Button onPress={onGoToAction} size="sm" variant="secondary">
              Go to
            </Button>
          </div>
        </div>
      </Surface>
    </div>
  );
};
