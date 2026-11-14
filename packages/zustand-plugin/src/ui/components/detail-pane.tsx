import { useEffect, useMemo, useState } from 'react';
import { Undo2, X } from 'lucide-react';
import { Badge, Button, DescriptionList, EmptyState, SearchField, Tabs } from '@rozenite/ui';
import type { TransitionSource } from '../../shared/protocol';
import { canJump, indexOfSeq, stateAt, type StoreHistory } from '../history/model';
import { formatDuration, formatTime } from '../utils/format';
import { symbolicateStack, type Trace } from '../utils/trace';
import { panelActions, usePanelStore, type DetailTab } from '../state/panel-store';
import { jumpTo, loadRawTrace } from '../state/operations';
import { useRunWithToast } from '../state/use-run-with-toast';
import { DiffView } from './diff-view';
import { ValueTree } from './value-tree';
import { actionLabel } from './timeline';

const TAB_CLASS = 'shrink-0';

/** Diff / State / Action / Trace for the selected transition. */
export function DetailPane({ history, seq }: { history: StoreHistory; seq: number }) {
  const tab = usePanelStore((state) => state.detailTab);
  const run = useRunWithToast();
  const index = indexOfSeq(history, seq);
  const transition = history.entries[index];

  if (!transition) {
    return <EmptyState title="Transition no longer in history" description="It was trimmed." />;
  }
  const jumpable = canJump(history, seq);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
        <span className="min-w-0 truncate font-mono text-xs font-medium">
          {actionLabel(transition)}
        </span>
        <Badge size="sm" tone="neutral" variant="outline" className="normal-case">
          {history.descriptor.name} #{seq}
        </Badge>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            tone="neutral"
            disabled={!jumpable}
            title={
              jumpable
                ? 'Jump: restore the state right after this transition (J)'
                : `The app keeps only its last ${history.descriptor.maxAge} transitions (maxAge)`
            }
            onClick={() => void run('Jump', () => jumpTo(history.storeId, seq))}
          >
            <Undo2 /> Jump
          </Button>
          <Button
            size="sm"
            variant="ghost"
            tone="neutral"
            aria-label="Close"
            onClick={() => panelActions.select(null)}
          >
            <X />
          </Button>
        </span>
      </div>
      <Tabs
        // The Trace tab is disabled for a transition without a trace.
        value={tab === 'trace' && !transition.traceId ? 'diff' : tab}
        onValueChange={(value) => panelActions.setDetailTab(value as DetailTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 border-b border-border">
          <Tabs.List className="border-0">
            <Tabs.Tab value="diff" className={TAB_CLASS}>
              Diff
              <span className="ml-1 text-muted-foreground">{transition.patches.length}</span>
            </Tabs.Tab>
            <Tabs.Tab value="state" className={TAB_CLASS}>
              State
            </Tabs.Tab>
            <Tabs.Tab value="action" className={TAB_CLASS}>
              Action
            </Tabs.Tab>
            <Tabs.Tab value="trace" className={TAB_CLASS} disabled={!transition.traceId}>
              Trace
            </Tabs.Tab>
          </Tabs.List>
        </div>
        <Tabs.Panel value="diff" className="min-h-0 flex-1 overflow-auto">
          <DiffView patches={transition.patches} storeId={history.storeId} />
        </Tabs.Panel>
        <Tabs.Panel value="state" className="min-h-0 flex-1 overflow-auto">
          <StateAtPoint history={history} index={index} />
        </Tabs.Panel>
        <Tabs.Panel value="action" className="min-h-0 flex-1 overflow-auto">
          <ActionDetails history={history} index={index} />
        </Tabs.Panel>
        <Tabs.Panel value="trace" className="min-h-0 flex-1 overflow-auto">
          {transition.traceId ? <TraceView traceId={transition.traceId} /> : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

function StateAtPoint({ history, index }: { history: StoreHistory; index: number }) {
  const [search, setSearch] = useState('');
  const value = useMemo(() => stateAt(history, index), [history, index]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 p-2">
        <SearchField
          size="sm"
          placeholder="Search state…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        <ValueTree
          value={value}
          storeId={history.storeId}
          seq={history.entries[index]?.seq}
          search={search}
          defaultExpandDepth={1}
        />
      </div>
    </div>
  );
}

function ActionDetails({ history, index }: { history: StoreHistory; index: number }) {
  const transition = history.entries[index];
  const { action } = transition;
  return (
    <div className="space-y-3 p-3">
      <DescriptionList>
        <DescriptionList.Item label="Action">
          <span className="font-mono">{action.name}</span>
        </DescriptionList.Item>
        <DescriptionList.Item label="Attributed as">
          <span className="font-mono">{action.source}</span>
          <span className="ml-2 text-muted-foreground">{SOURCE_HELP[action.source]}</span>
        </DescriptionList.Item>
        <DescriptionList.Item label="Seq / time">
          <span className="font-mono">
            #{transition.seq} · {formatTime(transition.timestamp)}
          </span>
        </DescriptionList.Item>
        {transition.durationMs !== undefined && (
          <DescriptionList.Item label="set() duration">
            <span className="font-mono">{formatDuration(transition.durationMs)}</span>
          </DescriptionList.Item>
        )}
        {transition.replace && (
          <DescriptionList.Item label="Replace">set(…, true)</DescriptionList.Item>
        )}
      </DescriptionList>
      {action.args && action.args.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Arguments
          </div>
          <ValueTree
            value={action.args}
            storeId={history.storeId}
            basePath={['$args']}
            defaultExpandDepth={2}
          />
        </div>
      )}
    </div>
  );
}

const SOURCE_HELP: Record<TransitionSource, string> = {
  action: 'a store function called synchronously',
  async: "a set after an await inside the store's only pending async action",
  named: 'set(state, replace, "name")',
  external: 'useStore.setState() from outside the store',
  anonymous: 'no action or name accounts for it, or several async actions were pending',
  hydrate: 'persist rehydration',
  edit: 'a value edited from DevTools or by an agent',
  reload: 'Fast Refresh re-created the store',
};

function TraceView({ traceId }: { traceId: string }) {
  const [trace, setTrace] = useState<Trace | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTrace(undefined);
    setError(null);
    loadRawTrace(traceId)
      .then((raw) => (raw === null ? null : symbolicateStack(raw)))
      .then((result) => !cancelled && setTrace(result))
      .catch((loadError: unknown) => !cancelled && setError((loadError as Error).message));
    return () => {
      cancelled = true;
    };
  }, [traceId]);

  if (error) return <div className="p-3 text-xs text-danger">{error}</div>;
  if (trace === undefined)
    return <div className="p-3 text-xs text-muted-foreground">Symbolicating…</div>;
  if (trace === null) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        This trace was evicted from the device.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 font-mono text-xs">
      {trace.status !== 'complete' && (
        <div className="text-muted-foreground">
          {trace.status === 'failed'
            ? `Symbolication failed: ${trace.error ?? 'unknown error'} — showing bundle locations.`
            : 'Showing bundle locations (Metro symbolication unavailable).'}
        </div>
      )}
      {trace.codeFrame && (
        <div>
          <div className="mb-1 text-[11px] text-muted-foreground">
            {trace.codeFrame.fileName}:{trace.codeFrame.line}:{trace.codeFrame.column}
          </div>
          <pre className="overflow-auto rounded-sm border border-border bg-muted/40 p-2 text-[11px] leading-4">
            {trace.codeFrame.content}
          </pre>
        </div>
      )}
      <ol className="space-y-0.5">
        {trace.frames.map((frame, frameIndex) => (
          <li
            key={frameIndex}
            className={frame.isCollapsed ? 'text-muted-foreground/60' : 'text-foreground'}
          >
            <span>{frame.functionName ?? '<anonymous>'}</span>
            <span className="ml-2 text-muted-foreground">
              {frame.url
                ? `${frame.url}:${frame.lineNumber ?? '?'}:${frame.columnNumber ?? '?'}`
                : `${frame.generatedUrl ?? '?'}:${frame.generatedLineNumber ?? '?'}:${frame.generatedColumnNumber ?? '?'}`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
