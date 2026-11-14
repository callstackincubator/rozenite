import { createContext, useContext, useMemo, useState, type ComponentProps } from 'react';
import { ChevronDown, ChevronRight, Copy, Plus, Trash2, Pencil, Link2 } from 'lucide-react';
import { IconButton, Input, cn, useCopyToClipboard } from '@rozenite/ui';
import type { EncodedTagged, EncodedValue, StatePath } from '../../shared/codec';
import { formatPath } from '../../shared/patch';
import {
  childrenOf,
  editText,
  isContainer,
  isEditableLeaf,
  nodeKind,
  parseUserValue,
  pathKey,
  searchTree,
  stringifyForCopy,
  valueLabel,
  type NodeKind,
} from '../utils/encoded';
import { loadLazy } from '../state/operations';
import { useRunWithToast } from '../state/use-run-with-toast';

/**
 * Tree inspector for tagged (encoded) state values: Map/Set/Date/class
 * instances render natively, `lazy` nodes load from the device on expand,
 * and -- when `onEdit` is given -- values can be edited, added and removed.
 */

export type ValueTreeProps = {
  value: EncodedValue;
  storeId?: string;
  /**
   * Seq of the state shown, when it is one: unloaded values load from it
   * instead of from the (possibly evicted) seq they were first seen at.
   */
  seq?: number;
  /** Prefix of every path shown (for a sub-tree of the state). */
  basePath?: StatePath;
  defaultExpandDepth?: number;
  search?: string;
  onEdit?: (path: StatePath, value: EncodedValue, op: 'set' | 'remove') => Promise<unknown>;
  className?: string;
  /** Hide the root row and show its children directly. */
  hideRoot?: boolean;
};

type TreeContextValue = Omit<ValueTreeProps, 'value' | 'className' | 'hideRoot'> & {
  root: EncodedValue;
  visible: Set<string> | null;
  overrides: Map<string, boolean>;
  toggle: (key: string, open: boolean) => void;
  lazy: Map<string, LazyState>;
  setLazy: (key: string, state: LazyState) => void;
};

type LazyState =
  | { status: 'loading' }
  | { status: 'loaded'; value: EncodedValue }
  | { status: 'evicted' }
  | { status: 'error'; message: string };

const LAZY_STATUS: Record<LazyState['status'], string> = {
  loading: 'loading…',
  loaded: 'loaded',
  evicted: 'evicted · export earlier to keep it',
  error: 'error',
};

const TreeContext = createContext<TreeContextValue | null>(null);
const useTree = () => {
  const context = useContext(TreeContext);
  if (!context) throw new Error('ValueTree context missing');
  return context;
};

const KIND_CLASS: Record<NodeKind, string> = {
  string: 'text-primary',
  number: 'text-info',
  boolean: 'text-warning',
  null: 'text-muted-foreground',
  special: 'text-info',
  fn: 'text-muted-foreground italic',
  ref: 'text-muted-foreground',
  lazy: 'text-muted-foreground',
  object: 'text-muted-foreground',
  array: 'text-muted-foreground',
  map: 'text-muted-foreground',
  set: 'text-muted-foreground',
  class: 'text-muted-foreground',
};

const INDENT = 14;
/** `Input size="sm"` shrunk to the tree's 20px rows. */
const ROW_INPUT = 'h-5 rounded-sm px-1 font-mono';

export function ValueTree({
  value,
  className,
  hideRoot = true,
  search,
  defaultExpandDepth = 1,
  ...rest
}: ValueTreeProps) {
  const [overrides, setOverrides] = useState(() => new Map<string, boolean>());
  const [lazy, setLazyMap] = useState(() => new Map<string, LazyState>());
  const visible = useMemo(
    () => (search?.trim() ? searchTree(value, search) : null),
    [value, search],
  );

  const context: TreeContextValue = {
    ...rest,
    search,
    defaultExpandDepth,
    root: value,
    visible,
    overrides,
    toggle: (key, open) =>
      setOverrides((prev) => {
        const next = new Map(prev);
        next.set(key, open);
        return next;
      }),
    lazy,
    setLazy: (key, state) =>
      setLazyMap((prev) => {
        const next = new Map(prev);
        next.set(key, state);
        return next;
      }),
  };

  const basePath = rest.basePath ?? [];
  const kind = nodeKind(value);

  return (
    <TreeContext.Provider value={context}>
      {/* No tree roles: they promise arrow-key navigation this view does not have. */}
      <div className={cn('font-mono text-xs leading-5', className)}>
        {visible && visible.size === 0 ? (
          <div className="px-2 py-1 text-muted-foreground">No matches for “{search}”.</div>
        ) : hideRoot && isContainer(kind) ? (
          <Children value={value} path={basePath} depth={0} editable />
        ) : (
          <TreeNode label="$" value={value} path={basePath} depth={0} editable />
        )}
      </div>
    </TreeContext.Provider>
  );
}

/**
 * `editable` says whether the device can address `path` for an edit. It is
 * passed down rather than re-derived from the root for every node: inside a
 * Set, a ref or a value loaded lazily nothing is addressable.
 */
function Children({
  value,
  path,
  depth,
  editable,
}: {
  value: EncodedValue;
  path: StatePath;
  depth: number;
  editable: boolean;
}) {
  const { visible, onEdit } = useTree();
  const kind = nodeKind(value);
  const children = childrenOf(value, path);
  const childrenEditable = editable && kind !== 'set';
  const canAdd =
    !!onEdit && !visible && editable && (kind === 'object' || kind === 'class' || kind === 'array');

  return (
    <div>
      {children.length === 0 && (
        <div className="text-muted-foreground" style={{ paddingLeft: depth * INDENT + 18 }}>
          {kind === 'array' || kind === 'set' ? '[] empty' : '{} empty'}
        </div>
      )}
      {children
        .filter((child) => !visible || visible.has(pathKey(child.path)))
        .map((child) => (
          <TreeNode
            key={pathKey(child.path)}
            label={child.label}
            labelIsValue={child.labelIsValue}
            value={child.value}
            path={child.path}
            depth={depth}
            editable={childrenEditable}
            removable={!!onEdit && (kind === 'object' || kind === 'class' || kind === 'array')}
          />
        ))}
      {canAdd && <AddRow parent={value} path={path} depth={depth} />}
    </div>
  );
}

function TreeNode({
  label,
  labelIsValue,
  value,
  path,
  depth,
  editable: addressable,
  removable,
}: {
  label: string;
  labelIsValue?: boolean;
  value: EncodedValue;
  path: StatePath;
  depth: number;
  editable: boolean;
  removable?: boolean;
}) {
  const tree = useTree();
  const run = useRunWithToast();
  const key = pathKey(path);
  const kind = nodeKind(value);
  const lazyTag = kind === 'lazy' ? (value as Extract<EncodedTagged, { $t: 'lazy' }>) : undefined;
  // Keyed by the placeholder's seq too: the same path holds another value in
  // another state, and this component is reused as the shown state changes.
  const lazyKey = lazyTag ? `${key}@${lazyTag.seq}` : key;
  const lazyState = lazyTag ? tree.lazy.get(lazyKey) : undefined;
  const effective = lazyState?.status === 'loaded' ? lazyState.value : value;
  const effectiveKind = nodeKind(effective);
  const expandable =
    isContainer(effectiveKind) || (kind === 'lazy' && lazyState?.status !== 'evicted');
  const open = tree.visible
    ? tree.visible.has(key)
    : (tree.overrides.get(key) ??
      // An unloaded lazy node starts closed: opening it is what loads it.
      (kind === 'lazy' && lazyState?.status !== 'loaded'
        ? false
        : depth < (tree.defaultExpandDepth ?? 1)));
  const [editing, setEditing] = useState(false);

  const expand = async (next: boolean) => {
    tree.toggle(key, next);
    if (next && lazyTag && (!lazyState || lazyState.status === 'error') && tree.storeId) {
      tree.setLazy(lazyKey, { status: 'loading' });
      try {
        // The value is unchanged from `lazyTag.seq` up to the state shown, so
        // the shown state's seq loads it too, and is the one the device is
        // least likely to have evicted.
        const result = await loadLazy(tree.storeId, tree.seq ?? lazyTag.seq, lazyTag.path);
        tree.setLazy(
          lazyKey,
          result.evicted || result.value === null
            ? { status: 'evicted' }
            : { status: 'loaded', value: result.value as EncodedValue },
        );
      } catch (error) {
        tree.setLazy(lazyKey, { status: 'error', message: (error as Error).message });
      }
    }
  };

  // `effective` differs from `value` only for a lazy value, which is never edited.
  const editable =
    !!tree.onEdit && addressable && !isContainer(effectiveKind) && isEditableLeaf(value);

  return (
    <div>
      <div
        className="group flex min-w-0 items-center gap-1 rounded-sm pr-1 hover:bg-accent/40"
        style={{ paddingLeft: depth * INDENT }}
      >
        <button
          type="button"
          className={cn(
            'flex size-4 shrink-0 items-center justify-center text-muted-foreground',
            !expandable && 'invisible',
          )}
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={expandable ? open : undefined}
          tabIndex={expandable ? undefined : -1}
          onClick={() => void expand(!open)}
        >
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </button>
        <span
          className={cn('shrink-0', labelIsValue ? 'text-info' : 'text-foreground')}
          onClick={() => expandable && void expand(!open)}
        >
          {label}
        </span>
        <span className="shrink-0 text-muted-foreground">:</span>
        {editing ? (
          <EditField
            initial={editText(effective)}
            onCancel={() => setEditing(false)}
            onSubmit={async (next) => {
              await tree.onEdit?.(path, next, 'set');
              setEditing(false);
            }}
          />
        ) : (
          <ValueLabel value={effective} lazyState={lazyState} original={value} />
        )}
        <RowActions
          value={effective}
          path={path}
          onEdit={editable && !editing ? () => setEditing(true) : undefined}
          onRemove={
            removable && tree.onEdit && addressable
              ? () => void run('Remove', () => tree.onEdit?.(path, null, 'remove'))
              : undefined
          }
        />
      </div>
      {expandable && open && isContainer(effectiveKind) && (
        <Children
          value={effective}
          path={path}
          depth={depth + 1}
          editable={addressable && kind !== 'lazy' && kind !== 'ref'}
        />
      )}
    </div>
  );
}

function ValueLabel({
  value,
  original,
  lazyState,
}: {
  value: EncodedValue;
  original: EncodedValue;
  lazyState?: LazyState;
}) {
  const text = valueLabel(value);

  return (
    <span className={cn('min-w-0 truncate', KIND_CLASS[nodeKind(value)])} title={text}>
      {text}
      {nodeKind(original) === 'lazy' && (
        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {lazyState ? LAZY_STATUS[lazyState.status] : 'lazy · expand to load'}
          {lazyState?.status === 'error' && `: ${lazyState.message}`}
        </span>
      )}
    </span>
  );
}

function RowActions({
  value,
  path,
  onEdit,
  onRemove,
}: {
  value: EncodedValue;
  path: StatePath;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  const { copy } = useCopyToClipboard();
  return (
    <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
      {onEdit && (
        <RowButton label="Edit value" onClick={onEdit}>
          <Pencil />
        </RowButton>
      )}
      <RowButton label="Copy value" onClick={() => void copy(stringifyForCopy(value))}>
        <Copy />
      </RowButton>
      <RowButton
        label={`Copy path ${formatPath(path)}`}
        onClick={() => void copy(formatPath(path))}
      >
        <Link2 />
      </RowButton>
      {onRemove && (
        <RowButton label="Remove" className="hover:text-danger" onClick={onRemove}>
          <Trash2 />
        </RowButton>
      )}
    </span>
  );
}

/** An `IconButton` shrunk to the tree's 20px rows. */
function RowButton({ className, ...props }: ComponentProps<typeof IconButton>) {
  return (
    <IconButton
      size="sm"
      tone="neutral"
      variant="ghost"
      className={cn('size-5 rounded-sm [&_svg]:size-3', className)}
      {...props}
    />
  );
}

function EditField({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string;
  onSubmit: (value: EncodedValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    // Nothing changed: no write, so no panel transition either.
    if (text.trim() === initial.trim()) {
      onCancel();
      return;
    }
    const parsed = parseUserValue(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(parsed.value);
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="flex min-w-0 flex-1 items-center gap-1">
      <Input
        autoFocus
        size="sm"
        className={cn(
          ROW_INPUT,
          'flex-1',
          error && 'border-danger focus-visible:border-danger focus-visible:ring-danger',
        )}
        value={text}
        disabled={busy}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') void submit();
          if (event.key === 'Escape') onCancel();
        }}
        onBlur={() => !busy && !error && onCancel()}
        aria-label="Value (JSON)"
        title={error ?? 'JSON value · Enter to save · Esc to cancel'}
      />
      {error && <span className="shrink-0 text-[10px] text-danger">{error}</span>}
    </span>
  );
}

function AddRow({ parent, path, depth }: { parent: EncodedValue; path: StatePath; depth: number }) {
  const tree = useTree();
  const [open, setOpen] = useState(false);
  const [keyText, setKeyText] = useState('');
  const [valueText, setValueText] = useState('null');
  const [error, setError] = useState<string | null>(null);
  const isArray = Array.isArray(parent);

  if (!open) {
    return (
      <button
        type="button"
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        style={{ paddingLeft: depth * INDENT + 18 }}
        onClick={() => setOpen(true)}
      >
        <Plus className="size-3" /> {isArray ? 'append item' : 'add key'}
      </button>
    );
  }

  const submit = async () => {
    if (!isArray && !keyText.trim()) {
      setError('Key is required');
      return;
    }
    const parsed = parseUserValue(valueText);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const segment = isArray ? (parent as EncodedValue[]).length : keyText.trim();
    try {
      await tree.onEdit?.([...path, segment], parsed.value, 'set');
      setOpen(false);
      setKeyText('');
      setValueText('null');
    } catch (submitError) {
      setError((submitError as Error).message);
    }
  };

  return (
    <div className="flex items-center gap-1" style={{ paddingLeft: depth * INDENT + 18 }}>
      {!isArray && (
        <Input
          autoFocus
          size="sm"
          className={cn(ROW_INPUT, 'w-28')}
          placeholder="key"
          value={keyText}
          onChange={(event) => setKeyText(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label="New key"
        />
      )}
      <Input
        autoFocus={isArray}
        size="sm"
        className={cn(ROW_INPUT, 'flex-1')}
        placeholder="JSON value"
        value={valueText}
        onChange={(event) => {
          setValueText(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') void submit();
          if (event.key === 'Escape') setOpen(false);
        }}
        aria-label="New value"
      />
      <button type="button" className="text-[11px] text-primary" onClick={() => void submit()}>
        add
      </button>
      <button
        type="button"
        className="text-[11px] text-muted-foreground"
        onClick={() => setOpen(false)}
      >
        cancel
      </button>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  );
}
