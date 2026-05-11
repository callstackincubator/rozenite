import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import type { RHFEventMap, RHFUnmountEvent, RHFUpdateEvent } from '../shared/messaging';
import type { FieldError, FormSnapshot } from '../shared/types';
import './globals.css';

const PLUGIN_ID = '@rozenite/react-hook-form-plugin';

// React's useId() generates ids like ":r0:", ":r1a:", etc.
const REACT_AUTO_ID = /^:r[0-9a-z]+:$/;

function getFormLabel(id: string): string {
  return REACT_AUTO_ID.test(id) ? 'Form' : id;
}

// --- Field grouping ---

type RootField = { kind: 'field'; name: string };
type FieldGroup = { kind: 'group'; prefix: string; fields: string[] };
type FieldEntry = RootField | FieldGroup;

function groupFields(names: string[]): FieldEntry[] {
  const groupMap = new Map<string, string[]>();
  const result: FieldEntry[] = [];

  for (const name of names) {
    const dot = name.indexOf('.');
    if (dot === -1) {
      result.push({ kind: 'field', name });
    } else {
      const prefix = name.slice(0, dot);
      if (!groupMap.has(prefix)) groupMap.set(prefix, []);
      groupMap.get(prefix)!.push(name);
    }
  }

  for (const [prefix, fields] of groupMap) {
    result.push({ kind: 'group', prefix, fields });
  }

  return result;
}

// --- Small components ---

function Badge({ label, active, color }: { label: string; active: boolean; color: string }) {
  if (!active) return null;
  return (
    <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${color}`}>{label}</span>
  );
}

function ErrorCell({ error }: { error?: FieldError }) {
  if (!error?.type && !error?.message) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {error.type && (
        <span className="px-1.5 py-0.5 text-xs rounded font-medium bg-red-900 text-red-200 w-fit">
          {error.type}
        </span>
      )}
      {error.message && (
        <span className="text-xs text-red-300 truncate max-w-[200px]" title={error.message}>
          {error.message}
        </span>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// --- Form state bar ---

function FormStateBar({ formState }: { formState: FormSnapshot['formState'] }) {
  const badges = [
    { label: 'valid', active: formState.isValid, color: 'bg-green-800 text-green-200' },
    { label: 'invalid', active: !formState.isValid, color: 'bg-red-900 text-red-200' },
    { label: 'dirty', active: formState.isDirty, color: 'bg-yellow-800 text-yellow-200' },
    { label: 'submitting', active: formState.isSubmitting, color: 'bg-blue-800 text-blue-200' },
    { label: 'submitted', active: formState.isSubmitted, color: 'bg-purple-800 text-purple-200' },
    { label: 'submitSuccessful', active: formState.isSubmitSuccessful, color: 'bg-green-900 text-green-200' },
    { label: 'validating', active: formState.isValidating, color: 'bg-orange-800 text-orange-200' },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {badges.map((b) => (
        <Badge key={b.label} {...b} />
      ))}
      <span className="text-xs text-gray-400 ml-1">submits: {formState.submitCount}</span>
    </div>
  );
}

// --- Table rows ---

const COL_FIELD = 'px-3 py-2 text-gray-200 font-mono text-xs';
const COL_TYPE  = 'px-3 py-2 text-gray-400 font-mono text-xs w-20';
const COL_VALUE = 'px-3 py-2 text-gray-300 font-mono text-xs';
const COL_STATE = 'px-3 py-2 w-28';
const COL_ERROR = 'px-3 py-2';

function FieldRow({
  name,
  snapshot,
  indent = false,
}: {
  name: string;
  snapshot: FormSnapshot;
  indent?: boolean;
}) {
  const value   = snapshot.formValues[name];
  const error   = snapshot.formState.errors[name];
  const dirty   = snapshot.formState.dirtyFields[name];
  const touched = snapshot.formState.touchedFields[name];
  const type    = snapshot.formState.nativeFields[name];

  return (
    <tr className="border-b border-gray-700 hover:bg-gray-800/50 transition-colors">
      <td className={COL_FIELD}>
        <span
          className={`truncate block max-w-[180px] ${indent ? 'pl-4 text-gray-400' : ''}`}
          title={name}
        >
          {indent ? name.slice(name.indexOf('.') + 1) : name}
        </span>
      </td>
      <td className={COL_TYPE}>{type ?? <span className="text-gray-600">—</span>}</td>
      <td className={COL_VALUE}>
        <span className="truncate block max-w-[200px]" title={formatValue(value)}>
          {formatValue(value)}
        </span>
      </td>
      <td className={COL_STATE}>
        <div className="flex items-center gap-1 flex-wrap">
          <Badge label="dirty"   active={!!dirty}   color="bg-yellow-800 text-yellow-200" />
          <Badge label="touched" active={!!touched} color="bg-blue-900 text-blue-200" />
        </div>
      </td>
      <td className={COL_ERROR}>
        <ErrorCell error={error} />
      </td>
    </tr>
  );
}

function GroupSection({
  group,
  snapshot,
  defaultOpen,
}: {
  group: FieldGroup;
  snapshot: FormSnapshot;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const hasError = group.fields.some((f) => snapshot.formState.errors[f]?.type);
  const isDirty  = group.fields.some((f) => snapshot.formState.dirtyFields[f]);

  return (
    <tbody>
      <tr
        className="border-b border-gray-700 bg-gray-800 cursor-pointer select-none hover:bg-gray-750 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-3 py-1.5" colSpan={5}>
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
            )}
            <span className="font-mono text-xs text-gray-200 font-medium">{group.prefix}</span>
            <span className="text-xs text-gray-500">{group.fields.length} fields</span>
            {isDirty  && <Badge label="dirty"  active color="bg-yellow-800 text-yellow-200" />}
            {hasError && <Badge label="errors" active color="bg-red-900 text-red-200" />}
          </div>
        </td>
      </tr>
      {open &&
        group.fields.map((name) => (
          <FieldRow key={name} name={name} snapshot={snapshot} indent />
        ))}
    </tbody>
  );
}

// --- Field table ---

function FieldTable({ snapshot, searchTerm }: { snapshot: FormSnapshot; searchTerm: string }) {
  const allNames = Object.keys(snapshot.formValues);

  const filtered = useMemo(() => {
    if (!searchTerm) return allNames;
    const lower = searchTerm.toLowerCase();
    return allNames.filter((n) => n.toLowerCase().includes(lower));
  }, [allNames, searchTerm]);

  const entries = useMemo(() => groupFields(filtered), [filtered]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center w-full">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">No fields found</h3>
        <p className="text-gray-400 text-sm">
          {searchTerm ? 'Try adjusting your search' : 'No registered fields'}
        </p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead className="sticky top-0 bg-gray-800 z-10">
        <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
          <th className="px-3 py-2 font-medium border-b border-gray-700">Field</th>
          <th className="px-3 py-2 font-medium border-b border-gray-700 w-20">Type</th>
          <th className="px-3 py-2 font-medium border-b border-gray-700">Value</th>
          <th className="px-3 py-2 font-medium border-b border-gray-700 w-28">State</th>
          <th className="px-3 py-2 font-medium border-b border-gray-700">Error</th>
        </tr>
      </thead>
      {entries.map((entry) =>
        entry.kind === 'field' ? (
          <tbody key={entry.name}>
            <FieldRow name={entry.name} snapshot={snapshot} />
          </tbody>
        ) : (
          <GroupSection
            key={entry.prefix}
            group={entry}
            snapshot={snapshot}
            defaultOpen={!searchTerm || entry.fields.some((f) => f.toLowerCase().includes(searchTerm.toLowerCase()))}
          />
        )
      )}
    </table>
  );
}

// --- Form selector tabs ---

function FormTabs({
  options,
  selectedId,
  staleIds,
  onSelect,
}: {
  options: { id: string; label: string; fieldCount: number }[];
  selectedId: string | null;
  staleIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
      {options.map((opt) => {
        const stale    = staleIds.has(opt.id);
        const selected = opt.id === selectedId;
        return (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className={[
              'flex items-center gap-1.5 px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors',
              selected
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
              stale ? 'opacity-60' : '',
            ].join(' ')}
          >
            {stale && <span className="text-yellow-400">●</span>}
            <span>{opt.label}</span>
            <span className={selected ? 'text-blue-200' : 'text-gray-500'}>
              ({opt.fieldCount})
            </span>
          </button>
        );
      })}
    </div>
  );
}

// --- Panel ---

export default function ReactHookFormPanel() {
  const [snapshots, setSnapshots]     = useState<Map<string, FormSnapshot>>(new Map());
  const [staleIds, setStaleIds]       = useState<Set<string>>(new Set());
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm]   = useState('');

  const client = useRozeniteDevToolsClient<RHFEventMap>({ pluginId: PLUGIN_ID });

  useEffect(() => {
    if (!client) return;

    const updateSub = client.onMessage('update', (event: RHFUpdateEvent) => {
      const { snapshot } = event;
      setSnapshots((prev) => {
        const next = new Map(prev);
        next.set(snapshot.id, snapshot);
        return next;
      });
      setStaleIds((prev) => {
        if (!prev.has(snapshot.id)) return prev;
        const next = new Set(prev);
        next.delete(snapshot.id);
        return next;
      });
      setSelectedFormId((prev) => prev ?? snapshot.id);
    });

    const unmountSub = client.onMessage('unmount', (event: RHFUnmountEvent) => {
      setStaleIds((prev) => {
        const next = new Set(prev);
        next.add(event.id);
        return next;
      });
    });

    return () => {
      updateSub.remove();
      unmountSub.remove();
    };
  }, [client]);

  const selectedSnapshot = selectedFormId ? snapshots.get(selectedFormId) ?? null : null;
  const isStale          = selectedFormId ? staleIds.has(selectedFormId) : false;

  const formOptions = useMemo(
    () =>
      [...snapshots.keys()].map((id, index) => ({
        id,
        label: REACT_AUTO_ID.test(id) ? `Form ${index + 1}` : id,
        fieldCount: Object.keys(snapshots.get(id)!.formValues).length,
      })),
    [snapshots]
  );

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-700 bg-gray-800">
        <span className="text-sm font-semibold text-gray-100 shrink-0">React Hook Form</span>
        {formOptions.length > 0 && (
          <FormTabs
            options={formOptions}
            selectedId={selectedFormId}
            staleIds={staleIds}
            onSelect={setSelectedFormId}
          />
        )}
      </div>

      {/* Form state bar */}
      {selectedSnapshot && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 bg-gray-800">
          <FormStateBar formState={selectedSnapshot.formState} />
        </div>
      )}

      {/* Stale banner */}
      {isStale && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-900/40 border-b border-yellow-700/50 text-yellow-300 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Form has unmounted — showing last known state.
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search fields…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 w-full pl-8 pr-3 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Content */}
      <main className="flex flex-1 min-h-0 overflow-auto">
        {selectedSnapshot ? (
          <FieldTable snapshot={selectedSnapshot} searchTerm={searchTerm} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center w-full">
            <h2 className="text-xl font-semibold text-gray-200 mb-2">React Hook Form Inspector</h2>
            <p className="text-gray-400 text-sm">
              Call{' '}
              <code className="text-blue-400">useRozeniteRHFPlugin({'{ control }'})</code>{' '}
              in your form component
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
