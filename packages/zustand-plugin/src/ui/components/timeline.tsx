import { useMemo } from 'react';
import { History } from 'lucide-react';
import { Badge, EmptyState, VirtualizedList, cn } from '@rozenite/ui';
import { summarizeEncoded } from '../../shared/codec';
import type { Transition } from '../../shared/protocol';
import { timelineEntries, type HistoryModel, type TimelineEntry } from '../history/model';
import { matchesFilter, parseFilter } from '../history/filter';
import { SOURCE_BADGES, formatDuration, formatTime } from '../utils/format';
import { panelActions, usePanelStore, type Selection } from '../state/panel-store';

type TimelineRow = { key: string; entry: TimelineEntry };

const entryKey = (storeId: string, seq: number) => `${storeId}:${seq}`;

export const actionLabel = (transition: Transition) => {
  const { action } = transition;
  const args =
    action.args && action.args.length > 0
      ? `(${action.args.map((arg) => summarizeEncoded(arg, 24)).join(', ')})`
      : action.source === 'action' || action.source === 'async'
        ? '()'
        : '';
  return `${action.name}${args}`;
};

/** The visible entries as rows; Fast Refresh reloads become boundaries. */
export const buildRows = (
  model: HistoryModel,
  storeId: string | null,
  filter: string,
): TimelineRow[] => {
  const terms = parseFilter(filter);
  return timelineEntries(model, storeId)
    .filter((entry) =>
      matchesFilter(terms, {
        storeName: entry.storeName,
        actionName: entry.transition.action.name,
        source: entry.transition.action.source,
      }),
    )
    .map((entry) => ({ key: entryKey(entry.storeId, entry.transition.seq), entry }));
};

/** What a screen reader announces for a row (the list falls back to its key). */
const rowTextValue = (row: TimelineRow): string => {
  const { transition } = row.entry;
  return `${row.entry.storeName} #${transition.seq}: ${actionLabel(transition)} at ${formatTime(
    transition.timestamp,
  )}`;
};

const isSelected = (selection: Selection | null, entry: TimelineEntry) =>
  !!selection && selection.storeId === entry.storeId && selection.seq === entry.transition.seq;

function EntryRow({ entry }: { entry: TimelineEntry }) {
  const selection = usePanelStore((state) => state.selection);
  const showStore = usePanelStore((state) => state.selectedStoreId === null);
  const jumpedTo = usePanelStore(
    (state) => state.model.stores.get(entry.storeId)?.descriptor.jumpedTo,
  );
  const { transition } = entry;
  const { action } = transition;
  const selected = isSelected(selection, entry);
  const badge = SOURCE_BADGES[action.source];

  return (
    <div
      className={cn(
        'flex h-6 min-w-0 cursor-pointer items-center gap-2 border-l-2 border-transparent px-2 font-mono text-xs',
        selected ? 'border-l-primary bg-accent' : 'hover:bg-accent/50',
      )}
    >
      <span className="w-3 shrink-0 text-primary" title="The store was jumped to this state">
        {jumpedTo === transition.seq ? '►' : ''}
      </span>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {formatTime(transition.timestamp)}
      </span>
      {showStore && (
        <Badge size="sm" tone="neutral" variant="outline" className="shrink-0 normal-case">
          {entry.storeName}
        </Badge>
      )}
      <span className="min-w-0 truncate text-foreground">
        {actionLabel(transition)}
        {action.source === 'async' && <span className="text-muted-foreground"> · after await</span>}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {transition.replace && (
          <Badge size="sm" tone="neutral" variant="outline">
            replace
          </Badge>
        )}
        {badge && (
          <Badge size="sm" tone={badge.tone} variant="soft">
            {badge.label}
          </Badge>
        )}
        <span className="w-12 text-right tabular-nums text-muted-foreground">
          {formatDuration(transition.durationMs)}
        </span>
      </span>
    </div>
  );
}

function BoundaryRow({ entry }: { entry: TimelineEntry }) {
  return (
    <div className="flex h-6 items-center gap-2 px-2 text-[11px] text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      <span className="font-mono">♻ reloaded{entry.storeName ? ` · ${entry.storeName}` : ''}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function Timeline() {
  const model = usePanelStore((state) => state.model);
  const storeId = usePanelStore((state) => state.selectedStoreId);
  const filter = usePanelStore((state) => state.filter);
  const status = usePanelStore((state) => state.status);

  const rows = useMemo(() => buildRows(model, storeId, filter), [model, storeId, filter]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={History}
        title={
          filter
            ? 'No transitions match'
            : model.stores.size === 0
              ? 'No stores yet'
              : 'No transitions yet'
        }
        description={
          filter
            ? 'Try another filter. Terms: `cart/*`, `-scroll`, `source:async`, `store:auth`.'
            : model.stores.size === 0
              ? status === 'connected'
                ? 'Wrap a store with rozenite() from @rozenite/zustand-plugin.'
                : 'Waiting for the app to connect…'
              : 'Interact with the app; every state change shows up here.'
        }
      />
    );
  }

  return (
    <VirtualizedList
      ariaLabel="State transitions"
      data={rows}
      getItemKey={(row) => row.key}
      getItemTextValue={rowTextValue}
      followOutput="auto"
      initialTopMostItemIndex={rows.length - 1}
      style={{ height: '100%' }}
      onItemClick={(row) => {
        // Through the list, so Enter / Space on a focused row work too.
        panelActions.select({ storeId: row.entry.storeId, seq: row.entry.transition.seq });
      }}
      renderItem={({ entry }) =>
        entry.transition.action.source === 'reload' ? (
          <BoundaryRow entry={entry} />
        ) : (
          <EntryRow entry={entry} />
        )
      }
    />
  );
}
