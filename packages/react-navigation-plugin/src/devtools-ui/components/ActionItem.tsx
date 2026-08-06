import { formatFrameLocation } from '../../react-native/symbolication/format';
import type { ActionOrigin } from '../../react-native/symbolication/types';
import { NavigationAction } from '../../shared';
import { Badge, Button } from '@rozenite/ui';

export type ActionItemProps = {
  action: NavigationAction;
  origin: ActionOrigin | undefined;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onGoToAction: () => void;
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
    return <div className="mt-1 text-xs italic text-muted-foreground">↳ Resolving…</div>;
  }
  if (origin.symbolicationStatus !== 'complete') return null;
  if (origin.confidence === 'none') return null;
  const location = formatFrameLocation(origin.originFrame);
  if (!location) return null;
  return (
    <div
      className={`mt-1 truncate font-mono text-xs text-muted-foreground ${
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
    !!action.payload && 'name' in action.payload && typeof action.payload.name === 'string'
      ? action.payload.name
      : undefined;

  return (
    <div
      className={`m-1 cursor-pointer border p-3 transition-colors ${
        isSelected ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-muted'
      }`}
      onClick={onSelect}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{action.type}</Badge>
          <span className="text-xs text-muted-foreground">#{index}</span>
        </div>
        <Button
          size="compact"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onGoToAction();
          }}
        >
          Go to
        </Button>
      </div>

      {actionName && <div className="text-xs text-foreground">→ {actionName}</div>}

      <OriginPreview origin={origin} />
    </div>
  );
};
