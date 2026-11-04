import { useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import {
  Badge,
  Button,
  DescriptionList,
  EmptyState,
  SearchField,
  Tabs,
  Textarea,
  useConfirmDialog,
} from '@rozenite/ui';
import type { EncodedValue, StatePath } from '../../shared/codec';
import type { ActionDescriptor } from '../../shared/protocol';
import { currentState, lastSeq, type StoreHistory } from '../history/model';
import { parseUserValue } from '../utils/encoded';
import { panelActions, usePanelStore, type HomeTab } from '../state/panel-store';
import { editPath, invokeAction, persistCommand } from '../state/operations';
import { useRunWithToast } from '../state/use-run-with-toast';
import { ValueTree } from './value-tree';

/** What a selected store shows when no transition is selected. */
export function StoreHome({ history }: { history: StoreHistory }) {
  const tab = usePanelStore((state) => state.homeTab);
  const { descriptor } = history;
  const effectiveTab = tab === 'persist' && !descriptor.persist ? 'state' : tab;

  return (
    <Tabs
      value={effectiveTab}
      onValueChange={(value) => panelActions.setHomeTab(value as HomeTab)}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex shrink-0 items-center border-b border-border pr-2">
        <Tabs.List className="min-w-0 flex-1 overflow-x-auto border-0">
          <Tabs.Tab value="state">State</Tabs.Tab>
          <Tabs.Tab value="actions">
            Actions <span className="ml-1 text-muted-foreground">{descriptor.actions.length}</span>
          </Tabs.Tab>
          {descriptor.persist && <Tabs.Tab value="persist">Persist</Tabs.Tab>}
        </Tabs.List>
        {descriptor.generation > 1 && (
          <Badge size="sm" tone="neutral" variant="outline" title="Re-created by Fast Refresh">
            gen {descriptor.generation}
          </Badge>
        )}
      </div>
      <Tabs.Panel value="state" className="min-h-0 flex-1 overflow-hidden">
        <LiveState history={history} />
      </Tabs.Panel>
      <Tabs.Panel value="actions" className="min-h-0 flex-1 overflow-auto">
        <ActionsTab history={history} />
      </Tabs.Panel>
      {descriptor.persist && (
        <Tabs.Panel value="persist" className="min-h-0 flex-1 overflow-auto">
          <PersistTab history={history} />
        </Tabs.Panel>
      )}
    </Tabs>
  );
}

function LiveState({ history }: { history: StoreHistory }) {
  const [search, setSearch] = useState('');
  const { jumpedTo } = history.descriptor;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 p-2">
        <SearchField
          size="sm"
          placeholder="Search keys and values…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
        />
        {jumpedTo === undefined ? (
          <Badge size="sm" tone="success" variant="soft">
            live
          </Badge>
        ) : (
          <Badge
            size="sm"
            tone="info"
            variant="soft"
            title="Time traveled; the app has not changed it since"
          >
            at #{jumpedTo}
          </Badge>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        <ValueTree
          value={currentState(history)}
          storeId={history.storeId}
          seq={jumpedTo ?? lastSeq(history)}
          search={search}
          defaultExpandDepth={1}
          onEdit={(path: StatePath, next: EncodedValue, op: 'set' | 'remove') =>
            editPath(history.storeId, path, next, op)
          }
        />
      </div>
    </div>
  );
}

function ActionsTab({ history }: { history: StoreHistory }) {
  const { descriptor } = history;
  if (descriptor.actions.length === 0) {
    return (
      <EmptyState
        title="No actions"
        description="This store's state holds no functions. Actions defined inside the store initializer show up here and can be called with JSON arguments."
      />
    );
  }
  return (
    <div className="divide-y divide-border">
      {descriptor.actions.map((action) => (
        <ActionInvoker key={action.path} storeId={history.storeId} action={action} />
      ))}
    </div>
  );
}

function ActionInvoker({ storeId, action }: { storeId: string; action: ActionDescriptor }) {
  const [open, setOpen] = useState(false);
  const [argsText, setArgsText] = useState(
    action.arity > 0 ? `[${Array(action.arity).fill('null').join(', ')}]` : '[]',
  );
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<
    { ok: true; value: EncodedValue } | { ok: false; error: string } | null
  >(null);

  const run = async () => {
    const parsed = parseUserValue(argsText);
    if (!parsed.ok || !Array.isArray(parsed.value)) {
      setOutcome({
        ok: false,
        error: parsed.ok ? 'Arguments must be a JSON array, e.g. [42, "x"].' : parsed.error,
      });
      return;
    }
    setBusy(true);
    setOutcome(null);
    try {
      const { result } = await invokeAction(storeId, action.path, parsed.value);
      setOutcome({ ok: true, value: result });
    } catch (error) {
      setOutcome({ ok: false, error: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left font-mono text-xs"
          onClick={() => setOpen(!open)}
        >
          <span className="text-muted-foreground">ƒ </span>
          {action.path}
          <span className="text-muted-foreground">
            ({action.arity > 0 ? `${action.arity} arg${action.arity > 1 ? 's' : ''}` : ''})
          </span>
        </button>
        <Button
          size="sm"
          variant="soft"
          tone="primary"
          disabled={busy}
          onClick={() => (open ? void run() : setOpen(true))}
        >
          <Play /> {open ? (busy ? 'Calling…' : 'Call') : 'Call…'}
        </Button>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <Textarea
            className="min-h-14 font-mono text-xs"
            value={argsText}
            onChange={(event) => setArgsText(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void run();
            }}
            aria-label={`Arguments for ${action.path} (JSON array)`}
            placeholder="JSON array of arguments · ⌘↵ to call"
          />
          {outcome &&
            (outcome.ok ? (
              <div className="rounded-sm border border-border p-2">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  returned
                </div>
                <ValueTree value={outcome.value} hideRoot={false} defaultExpandDepth={1} />
              </div>
            ) : (
              <div className="font-mono text-xs text-danger">{outcome.error}</div>
            ))}
        </div>
      )}
    </div>
  );
}

function PersistTab({ history }: { history: StoreHistory }) {
  const persist = history.descriptor.persist;
  const runWithToast = useRunWithToast();
  const confirm = useConfirmDialog();
  const [busy, setBusy] = useState(false);
  if (!persist) return null;

  const run = async (command: 'rehydrate' | 'clear') => {
    setBusy(true);
    await runWithToast('Persist command', () => persistCommand(history.storeId, command));
    setBusy(false);
  };

  return (
    <div className="space-y-3 p-3">
      <DescriptionList>
        <DescriptionList.Item label="Storage key">
          <span className="font-mono">{persist.storageKey}</span>
        </DescriptionList.Item>
        <DescriptionList.Item label="Version">
          <span className="font-mono">{persist.version ?? '—'}</span>
        </DescriptionList.Item>
        <DescriptionList.Item label="Hydrated">
          <Badge size="sm" tone={persist.hasHydrated ? 'success' : 'warning'} variant="soft">
            {persist.hasHydrated ? 'yes' : 'pending'}
          </Badge>
        </DescriptionList.Item>
      </DescriptionList>
      <p className="text-xs text-muted-foreground">
        Time travel and edits write through to storage, as any other state change does.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          tone="neutral"
          disabled={busy}
          onClick={() => void run('rehydrate')}
        >
          <RefreshCw /> Rehydrate
        </Button>
        <Button
          size="sm"
          variant="outline"
          tone="danger"
          disabled={busy}
          onClick={async () => {
            const ok = await confirm({
              title: `Clear storage of ${history.descriptor.name}?`,
              description: `The persisted entry "${persist.storageKey}" is removed from storage. The store's current state stays as it is.`,
              tone: 'danger',
              confirmLabel: 'Clear storage',
            });
            if (ok) await run('clear');
          }}
        >
          Clear storage
        </Button>
      </div>
    </div>
  );
}
