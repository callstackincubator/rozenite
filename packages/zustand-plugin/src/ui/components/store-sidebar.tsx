import { useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, Database, Pause } from 'lucide-react';
import { IndicatorDot, SearchField, Sidebar, cn } from '@rozenite/ui';
import type { StoreHistory } from '../history/model';
import { formatRelative } from '../utils/format';
import { panelActions, usePanelStore } from '../state/panel-store';

const useFlash = (value: number) => {
  const [flash, setFlash] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(timer);
  }, [value]);
  return flash;
};

function StoreItem({ store }: { store: StoreHistory }) {
  const selected = usePanelStore((state) => state.selectedStoreId === store.storeId);
  const flash = useFlash(store.lastUpdated);
  const { descriptor } = store;

  return (
    <Sidebar.Item
      selected={selected}
      size="sm"
      title={`${descriptor.name} · updated ${formatRelative(store.lastUpdated)}`}
      className={cn('transition-colors duration-[120ms]', flash && 'bg-info-soft')}
      leading={<IndicatorDot tone={flash ? 'info' : 'success'} />}
      trailing={
        <span className="flex items-center gap-1">
          {!descriptor.recording && (
            <Pause className="size-3 text-warning" aria-label="Recording paused" />
          )}
          {descriptor.persist && (
            <Database className="size-3 text-muted-foreground" aria-label="Persisted" />
          )}
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {store.entries.length}
          </span>
        </span>
      }
      onClick={() => panelActions.selectStore(store.storeId)}
    >
      <span className="truncate">{descriptor.name}</span>
    </Sidebar.Item>
  );
}

export function StoreSidebar() {
  const stores = usePanelStore((state) => state.model.stores);
  const selectedStoreId = usePanelStore((state) => state.selectedStoreId);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...stores.values()]
      .filter((store) => !needle || store.descriptor.name.toLowerCase().includes(needle))
      .sort((a, b) => a.descriptor.name.localeCompare(b.descriptor.name));
  }, [stores, query]);

  const total = useMemo(
    () => [...stores.values()].reduce((sum, store) => sum + store.entries.length, 0),
    [stores],
  );

  return (
    <Sidebar className="h-full w-full border-r-0">
      <Sidebar.Header className="p-2">
        <SearchField
          size="sm"
          placeholder="Filter stores…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery('')}
        />
      </Sidebar.Header>
      <div className="min-h-0 flex-1 overflow-auto">
        <Sidebar.Group>
          <Sidebar.Item
            size="sm"
            selected={selectedStoreId === null}
            leading={<Boxes className="size-3.5" />}
            trailing={
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {total}
              </span>
            }
            onClick={() => panelActions.selectStore(null)}
          >
            All stores
          </Sidebar.Item>
        </Sidebar.Group>
        <Sidebar.Group label="Stores">
          {visible.length === 0 && (
            <div className="px-3 py-2 text-xs text-sidebar-foreground/60">
              {stores.size === 0 ? 'Waiting for stores…' : 'No stores match.'}
            </div>
          )}
          {visible.map((store) => (
            <StoreItem key={store.storeId} store={store} />
          ))}
        </Sidebar.Group>
      </div>
    </Sidebar>
  );
}
