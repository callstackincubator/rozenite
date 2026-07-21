import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Chip, ListBox, PluginHeader, PluginTheme, SearchField, Select } from '@rozenite/ui';
import type { RHFEventMap, RHFInitEvent, RHFUnmountEvent, RHFUpdateEvent } from '../shared/messaging';
import type { FieldError, FormSnapshot } from '../shared/types';
import './globals.css';

const PLUGIN_ID = '@rozenite/rhf-plugin';

// React's useId() generates ids like ":r0:", ":r1a:", etc.
const REACT_AUTO_ID = /^:r[0-9a-z]+:$/;

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

type BadgeColor = 'success' | 'danger' | 'warning' | 'accent' | 'default';

function StatusChip({ label, active, color }: { label: string; active: boolean; color: BadgeColor }) {
  if (!active) return null;
  return <Chip color={color} className="h-5 text-xs">{label}</Chip>;
}

function ErrorCell({ error }: { error?: FieldError }) {
  if (!error?.type && !error?.message) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {error.type && (
        <Chip color="danger" className="w-fit h-5 text-xs">{error.type}</Chip>
      )}
      {error.message && (
        <span className="text-xs text-danger truncate max-w-[200px]" title={error.message}>
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
  const badges: Array<{ label: string; active: boolean; color: BadgeColor }> = [
    { label: 'valid',           active: formState.isValid,           color: 'success' },
    { label: 'invalid',         active: !formState.isValid,          color: 'danger'  },
    { label: 'dirty',           active: formState.isDirty,           color: 'warning' },
    { label: 'submitting',      active: formState.isSubmitting,      color: 'accent'  },
    { label: 'submitted',       active: formState.isSubmitted,       color: 'default' },
    { label: 'submitSuccessful',active: formState.isSubmitSuccessful,color: 'success' },
    { label: 'validating',      active: formState.isValidating,      color: 'warning' },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {badges.map((b) => (
        <StatusChip key={b.label} {...b} />
      ))}
      <span className="text-xs text-muted ml-1">submits: {formState.submitCount}</span>
    </div>
  );
}

// --- Table rows ---

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
    <tr className="border-b border-border hover:bg-surface/50 transition-colors">
      <td className="px-3 py-1.5 text-foreground font-mono text-xs align-middle">
        <span className={indent ? 'pl-4 text-muted' : ''}>
          {indent ? name.slice(name.indexOf('.') + 1) : name}
        </span>
      </td>
      <td className="px-3 py-1.5 text-muted font-mono text-xs w-20 align-middle">
        {type ?? <span className="opacity-40">—</span>}
      </td>
      <td className="px-3 py-1.5 text-foreground/80 font-mono text-xs align-middle max-w-[220px]">
        <span className="break-all">{formatValue(value)}</span>
      </td>
      <td className="px-3 py-1.5 w-28 align-middle">
        <span className="inline-flex gap-1 flex-wrap">
          {dirty   && <Chip color="warning" className="h-5 text-xs">dirty</Chip>}
          {touched && <Chip color="accent"  className="h-5 text-xs">touched</Chip>}
        </span>
      </td>
      <td className="px-3 py-1.5 align-middle">
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
        className="border-b border-border bg-surface cursor-pointer select-none hover:bg-surface-secondary transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-3 py-1.5" colSpan={5}>
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="h-3 w-3 text-muted shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted shrink-0" />
            )}
            <span className="font-mono text-xs text-foreground font-medium">{group.prefix}</span>
            <span className="text-xs text-muted">{group.fields.length} fields</span>
            {isDirty  && <Chip color="warning" className="h-5 text-xs">dirty</Chip>}
            {hasError && <Chip color="danger"  className="h-5 text-xs">errors</Chip>}
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
        <h3 className="text-lg font-semibold text-foreground mb-2">No fields found</h3>
        <p className="text-muted text-sm">
          {searchTerm ? 'Try adjusting your search' : 'No registered fields'}
        </p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm border-collapse self-start h-auto">
      <thead className="sticky top-0 bg-surface z-10">
        <tr className="text-left text-xs text-muted uppercase tracking-wider">
          <th className="px-3 py-2 font-medium border-b border-border">Field</th>
          <th className="px-3 py-2 font-medium border-b border-border w-20">Type</th>
          <th className="px-3 py-2 font-medium border-b border-border">Value</th>
          <th className="px-3 py-2 font-medium border-b border-border w-28">State</th>
          <th className="px-3 py-2 font-medium border-b border-border">Error</th>
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

// --- Panel ---

export default function ReactHookFormPanel() {
  const [snapshots, setSnapshots]           = useState<Map<string, FormSnapshot>>(new Map());
  const [staleIds, setStaleIds]             = useState<Set<string>>(new Set());
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm]         = useState('');

  const client = useRozeniteDevToolsClient<RHFEventMap>({ pluginId: PLUGIN_ID });

  useEffect(() => {
    if (!client) return;

    client.send('init', { type: 'init' } satisfies RHFInitEvent);

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
  const selectedIsStale  = selectedFormId ? staleIds.has(selectedFormId) : false;

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
    <PluginTheme
      defaultTheme="dark"
      className="flex h-screen flex-col bg-background text-foreground"
    >
      <PluginHeader
        title="React Hook Form"
        subtitle="Inspect form state and field values."
        actions={
          formOptions.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="w-56 max-w-[44vw] min-w-40">
                <Select
                  placeholder="Select form"
                  value={selectedFormId ?? ''}
                  onChange={(value) => {
                    if (typeof value === 'string') setSelectedFormId(value);
                  }}
                  isDisabled={formOptions.length === 0}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {formOptions.map((opt) => (
                        <ListBox.Item
                          key={opt.id}
                          id={opt.id}
                          textValue={`${opt.label} (${opt.fieldCount} fields)${staleIds.has(opt.id) ? ' — disconnected' : ''}`}
                        >
                          {opt.label} ({opt.fieldCount} fields)
                          {staleIds.has(opt.id) ? ' — disconnected' : ''}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              {selectedIsStale && (
                <span className="text-xs text-warning flex items-center gap-1 shrink-0">
                  <AlertTriangle className="h-3 w-3" /> disconnected
                </span>
              )}
            </div>
          ) : undefined
        }
      />

      {selectedSnapshot && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <FormStateBar formState={selectedSnapshot.formState} />
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className="flex-1">
          <SearchField
            name="search"
            fullWidth
            value={searchTerm}
            onChange={setSearchTerm}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search fields…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </div>
      </div>

      <main className="flex flex-1 min-h-0 overflow-auto">
        {selectedSnapshot ? (
          <FieldTable snapshot={selectedSnapshot} searchTerm={searchTerm} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center w-full">
            <h2 className="text-xl font-semibold text-foreground mb-2">React Hook Form Inspector</h2>
            <p className="text-muted text-sm">
              Call{' '}
              <code className="text-accent">useRozeniteRHFPlugin({'{ control }'})</code>{' '}
              in your form component
            </p>
          </div>
        )}
      </main>
    </PluginTheme>
  );
}
