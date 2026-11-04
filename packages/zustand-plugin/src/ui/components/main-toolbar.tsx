import type { RefObject } from 'react';
import { Circle, Download, RefreshCw } from 'lucide-react';
import { IndicatorDot, Select, Toolbar, SearchField, cn, useToast } from '@rozenite/ui';
import { isRecording, panelActions, usePanelStore } from '../state/panel-store';
import { exportToFile, hello, setRecording } from '../state/operations';
import { useRunWithToast } from '../state/use-run-with-toast';

const ALL = '__all__';

export function MainToolbar({
  narrow,
  filterRef,
}: {
  narrow: boolean;
  filterRef: RefObject<HTMLInputElement | null>;
}) {
  const stores = usePanelStore((state) => state.model.stores);
  const selectedStoreId = usePanelStore((state) => state.selectedStoreId);
  const filter = usePanelStore((state) => state.filter);
  const status = usePanelStore((state) => state.status);
  const recording = usePanelStore(isRecording);
  const toast = useToast();
  const run = useRunWithToast();

  const selected = selectedStoreId ? stores.get(selectedStoreId) : undefined;

  const button = 'w-7 px-0';

  return (
    <Toolbar className="shrink-0 gap-1 border-b border-border px-1">
      {narrow && (
        <Select
          value={selectedStoreId ?? ALL}
          onValueChange={(value) =>
            panelActions.selectStore(value === ALL || value === null ? null : String(value))
          }
        >
          <Select.Trigger className="h-6 w-36 text-xs">
            <Select.Value>
              {(value: string) =>
                value === ALL ? 'All stores' : (stores.get(value)?.descriptor.name ?? value)
              }
            </Select.Value>
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={ALL}>All stores</Select.Item>
            {[...stores.values()].map((store) => (
              <Select.Item key={store.storeId} value={store.storeId}>
                {store.descriptor.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      )}
      <Toolbar.Group>
        <Toolbar.Button
          size="sm"
          className={button}
          title={recording ? 'Pause recording (Space)' : 'Resume recording (Space)'}
          aria-pressed={recording}
          disabled={stores.size === 0}
          onClick={() => void run('Recording', () => setRecording(selectedStoreId, !recording))}
        >
          <Circle className={cn(recording ? 'fill-danger text-danger' : 'text-muted-foreground')} />
        </Toolbar.Button>
      </Toolbar.Group>
      <Toolbar.Separator />
      <Toolbar.Group>
        <Toolbar.Button
          size="sm"
          className={button}
          title={selected ? `Export ${selected.descriptor.name} history` : 'Export all history'}
          disabled={stores.size === 0}
          onClick={() =>
            void run('Export', () => {
              const count = exportToFile(selected ? [selected.storeId] : undefined);
              toast.add({
                title: `Exported ${count} store${count === 1 ? '' : 's'}`,
                type: 'success',
              });
            })
          }
        >
          <Download />
        </Toolbar.Button>
        <Toolbar.Button
          size="sm"
          className={button}
          title="Resync with the app"
          onClick={() => void run('Resync', hello)}
        >
          <RefreshCw />
        </Toolbar.Button>
      </Toolbar.Group>
      <Toolbar.Separator />
      <div className="min-w-32 flex-1">
        <SearchField
          ref={filterRef}
          size="sm"
          placeholder="Filter: addItem  cart/*  -scroll  source:async  ( / )"
          value={filter}
          onChange={(event) => panelActions.setFilter(event.target.value)}
          onClear={() => panelActions.setFilter('')}
        />
      </div>
      <span
        className={cn(
          'ml-1 flex shrink-0 items-center gap-1 px-1 font-mono text-[10px] uppercase tracking-wide',
          status === 'connected'
            ? 'text-success'
            : status === 'connecting'
              ? 'text-muted-foreground'
              : 'text-warning',
        )}
        title={status === 'disconnected' ? 'The app is not answering; retrying.' : undefined}
      >
        <IndicatorDot
          tone={
            status === 'connected' ? 'success' : status === 'connecting' ? 'neutral' : 'warning'
          }
        />
        {!narrow && status}
      </span>
    </Toolbar>
  );
}
