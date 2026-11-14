import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@rozenite/ui';
import { summarizeEncoded, type EncodedValue } from '../../shared/codec';
import { formatPath, type StatePatch } from '../../shared/patch';
import { isContainer, nodeKind } from '../utils/encoded';
import { ValueTree } from './value-tree';

const OP_STYLE: Record<StatePatch['op'], { symbol: string; className: string }> = {
  add: { symbol: '+', className: 'text-success' },
  remove: { symbol: '−', className: 'text-danger' },
  replace: { symbol: '~', className: 'text-warning' },
};

/** Changed paths of one transition, old → new, with containers expandable. */
export function DiffView({
  patches,
  storeId,
}: {
  patches: readonly StatePatch[];
  storeId: string;
}) {
  if (patches.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">No state change (state is identical).</div>
    );
  }
  return (
    <div className="divide-y divide-border font-mono text-xs">
      {patches.map((patch, index) => (
        <PatchRow key={`${formatPath(patch.path)}:${index}`} patch={patch} storeId={storeId} />
      ))}
    </div>
  );
}

function PatchRow({ patch, storeId }: { patch: StatePatch; storeId: string }) {
  const [open, setOpen] = useState(false);
  const before = patch.op === 'add' ? undefined : patch.old;
  const after = patch.op === 'remove' ? undefined : patch.value;
  const expandable =
    (before !== undefined && isContainer(nodeKind(before))) ||
    (after !== undefined && isContainer(nodeKind(after)));
  const style = OP_STYLE[patch.op];

  return (
    <div className="px-3 py-1">
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2 text-left"
        onClick={() => expandable && setOpen(!open)}
      >
        <span className={cn('w-3 shrink-0 text-center font-bold', style.className)}>
          {style.symbol}
        </span>
        <span className="shrink-0 text-foreground">{formatPath(patch.path)}</span>
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {before !== undefined && (
            <Summary value={before} className="text-danger/90 line-through decoration-danger/40" />
          )}
          {before !== undefined && after !== undefined && (
            <span className="text-muted-foreground">→</span>
          )}
          {after !== undefined && <Summary value={after} className="text-success" />}
        </span>
        {expandable && (
          <span className="ml-auto text-muted-foreground">
            {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-1 grid grid-cols-1 gap-2 pl-5 md:grid-cols-2">
          {before !== undefined && (
            <div className="min-w-0 rounded-sm border border-border p-1">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                before
              </div>
              <ValueTree
                value={before}
                storeId={storeId}
                basePath={patch.path}
                defaultExpandDepth={2}
              />
            </div>
          )}
          {after !== undefined && (
            <div className="min-w-0 rounded-sm border border-border p-1">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                after
              </div>
              <ValueTree
                value={after}
                storeId={storeId}
                basePath={patch.path}
                defaultExpandDepth={2}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Summary({ value, className }: { value: EncodedValue; className?: string }) {
  return <span className={cn('truncate', className)}>{summarizeEncoded(value, 80)}</span>;
}
