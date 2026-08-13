import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  PluginShell,
  SearchField,
  Sidebar,
  Split,
  Toast,
  Toolbar,
  useToast,
} from '@rozenite/ui';
import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, FormInput, Trash2 } from 'lucide-react';
import type {
  RHFEventMap,
  RHFInitEvent,
  RHFUnmountEvent,
  RHFUpdateEvent,
} from '../shared/messaging';
import type { FormSnapshot } from '../shared/types';
import { FieldDetailDialog } from './field-detail-dialog';
import { buildFieldTree, flattenFieldTree, type FlatFieldRow } from './field-tree';
import { formatValue } from './format-value';
import './globals.css';

const PLUGIN_ID = '@rozenite/rhf-plugin';

// React's useId() generates ids like ":r0:", ":r1a:", etc.
const REACT_AUTO_ID = /^:r[0-9a-z]+:$/;

// --- Form state badges ---

function FormStateBadges({ formState }: { formState: FormSnapshot['formState'] }) {
  const badges: {
    label: string;
    active: boolean;
    variant: 'default' | 'secondary' | 'outline';
    className?: string;
  }[] = [
    {
      label: 'invalid',
      active: !formState.isValid,
      variant: 'outline',
      className: 'border-destructive/50 text-destructive',
    },
    { label: 'valid', active: formState.isValid, variant: 'default' },
    { label: 'dirty', active: formState.isDirty, variant: 'secondary' },
    { label: 'validating', active: formState.isValidating, variant: 'secondary' },
    { label: 'submitting', active: formState.isSubmitting, variant: 'secondary' },
    { label: 'submitted', active: formState.isSubmitted, variant: 'outline' },
    { label: 'submitSuccessful', active: formState.isSubmitSuccessful, variant: 'default' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {badges
        .filter((b) => b.active)
        .map((b) => (
          <Badge key={b.label} variant={b.variant} className={b.className}>
            {b.label}
          </Badge>
        ))}
      <span className="text-xs text-muted-foreground">submits: {formState.submitCount}</span>
    </div>
  );
}

// --- Field tree ---

function fieldStats(names: string[], snapshot: FormSnapshot) {
  let dirtyCount = 0;
  let errorCount = 0;
  for (const name of names) {
    if (snapshot.formState.dirtyFields[name]) dirtyCount += 1;
    const error = snapshot.formState.errors[name];
    if (error?.type || error?.message) errorCount += 1;
  }
  return { dirtyCount, errorCount };
}

const INDENT_BASE_PX = 12;
const INDENT_PER_DEPTH_PX = 16;

function GroupRow({
  row,
  snapshot,
}: {
  row: Extract<FlatFieldRow, { kind: 'group' }>;
  snapshot: FormSnapshot;
}) {
  const { dirtyCount, errorCount } = fieldStats(row.leafNames, snapshot);

  return (
    <tr className="border-b border-border bg-muted/40">
      <td
        colSpan={5}
        className="px-3 py-1.5"
        style={{ paddingLeft: INDENT_BASE_PX + row.depth * INDENT_PER_DEPTH_PX }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-foreground">{row.segment}</span>
          {errorCount > 0 && (
            <Badge variant="outline" className="border-destructive/50 text-destructive">
              {errorCount} error{errorCount === 1 ? '' : 's'}
            </Badge>
          )}
          {dirtyCount > 0 && <Badge variant="secondary">{dirtyCount} dirty</Badge>}
        </div>
      </td>
    </tr>
  );
}

function LeafRow({
  row,
  snapshot,
  onSelect,
}: {
  row: Extract<FlatFieldRow, { kind: 'leaf' }>;
  snapshot: FormSnapshot;
  onSelect: (name: string) => void;
}) {
  const value = snapshot.formValues[row.name];
  const error = snapshot.formState.errors[row.name];
  const hasError = Boolean(error?.type || error?.message);
  const dirty = Boolean(snapshot.formState.dirtyFields[row.name]);
  const touched = Boolean(snapshot.formState.touchedFields[row.name]);
  const type = snapshot.formState.nativeFields[row.name];

  return (
    <tr
      className="cursor-pointer border-b border-border hover:bg-accent/50"
      onClick={() => onSelect(row.name)}
    >
      <td
        className="px-3 py-1.5 font-mono text-xs text-foreground"
        style={{ paddingLeft: INDENT_BASE_PX + row.depth * INDENT_PER_DEPTH_PX }}
      >
        {row.segment}
      </td>
      <td className="px-3 py-1.5 text-xs text-muted-foreground">
        {type ?? <span className="text-muted-foreground/50">—</span>}
      </td>
      <td className="max-w-0 px-3 py-1.5">
        <span className="block truncate font-mono text-xs text-foreground">
          {formatValue(value)}
        </span>
      </td>
      <td className="px-3 py-1.5">
        <div className="flex flex-wrap gap-1">
          {dirty && <Badge variant="secondary">dirty</Badge>}
          {touched && <Badge variant="outline">touched</Badge>}
        </div>
      </td>
      <td className="px-3 py-1.5">
        {hasError && (
          <Badge variant="outline" className="border-destructive/50 text-destructive">
            {error?.type ?? 'error'}
          </Badge>
        )}
      </td>
    </tr>
  );
}

function FieldTable({
  rows,
  snapshot,
  onSelect,
}: {
  rows: FlatFieldRow[];
  snapshot: FormSnapshot;
  onSelect: (name: string) => void;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-card">
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th className="px-3 py-2 font-medium">Field</th>
          <th className="w-20 px-3 py-2 font-medium">Type</th>
          <th className="px-3 py-2 font-medium">Value</th>
          <th className="w-32 px-3 py-2 font-medium">State</th>
          <th className="w-28 px-3 py-2 font-medium">Error</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) =>
          row.kind === 'group' ? (
            <GroupRow key={row.path} row={row} snapshot={snapshot} />
          ) : (
            <LeafRow key={row.name} row={row} snapshot={snapshot} onSelect={onSelect} />
          ),
        )}
      </tbody>
    </table>
  );
}

// --- Panel ---

function ReactHookFormPanelContent() {
  const [snapshots, setSnapshots] = useState<Map<string, FormSnapshot>>(new Map());
  const [staleIds, setStaleIds] = useState<Set<string>>(new Set());
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFieldName, setSelectedFieldName] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const toast = useToast();
  const client = useRozeniteDevToolsClient<RHFEventMap>({
    pluginId: PLUGIN_ID,
  });

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

  const selectedSnapshot = selectedFormId ? (snapshots.get(selectedFormId) ?? null) : null;

  const formOptions = useMemo(
    () =>
      [...snapshots.keys()].map((id, index) => ({
        id,
        label: REACT_AUTO_ID.test(id) ? `Form ${index + 1}` : id,
      })),
    [snapshots],
  );

  const filteredFieldNames = useMemo(() => {
    if (!selectedSnapshot) return [];
    const allNames = Object.keys(selectedSnapshot.formValues);
    if (!searchTerm) return allNames;
    const lower = searchTerm.toLowerCase();
    return allNames.filter((name) => name.toLowerCase().includes(lower));
  }, [selectedSnapshot, searchTerm]);

  const fieldRows = useMemo(
    () => flattenFieldTree(buildFieldTree(filteredFieldNames)),
    [filteredFieldNames],
  );

  const canResetForm = Boolean(selectedFormId) && !staleIds.has(selectedFormId ?? '');

  const handleResetForm = async () => {
    if (!client || !selectedFormId) return;
    setShowResetConfirm(false);
    try {
      await client.request({
        requestType: 'reset-form',
        responseType: 'reset-form-result',
        errorType: 'rhf-request-error',
        payload: { type: 'reset-form', id: selectedFormId },
      });
    } catch (error) {
      toast.add({
        title: 'Could not reset form',
        description: error instanceof Error ? error.message : String(error),
        type: 'error',
      });
    }
  };

  return (
    <PluginShell>
      <PluginShell.Body>
        <Split direction="horizontal" autoSaveId="rhf">
          <Split.Pane defaultSize={22} minSize={15} maxSize={40}>
            <Sidebar className="w-full border-r-0">
              {formOptions.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-sidebar-foreground/60">
                  Waiting for forms…
                </div>
              ) : (
                <Sidebar.Group label="Forms">
                  {formOptions.map((option) => (
                    <Sidebar.Item
                      key={option.id}
                      selected={option.id === selectedFormId}
                      adornment={<FormInput />}
                      trailing={
                        staleIds.has(option.id) ? (
                          <Badge variant="outline">unmounted</Badge>
                        ) : undefined
                      }
                      onClick={() => setSelectedFormId(option.id)}
                    >
                      {option.label}
                    </Sidebar.Item>
                  ))}
                </Sidebar.Group>
              )}
            </Sidebar>
          </Split.Pane>
          <Split.Handle />
          <Split.Pane>
            <div className="flex h-full min-h-0 flex-col">
              {selectedSnapshot && (
                <Toolbar>
                  <Toolbar.Group>
                    <Toolbar.Button
                      onClick={() => setShowResetConfirm(true)}
                      disabled={!canResetForm}
                      aria-label="Reset form"
                      title="Reset form"
                      className="w-7 px-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Toolbar.Button>
                  </Toolbar.Group>
                  <Toolbar.Separator />
                  <div className="min-w-40 flex-1">
                    <SearchField
                      placeholder="Search fields…"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      onClear={() => setSearchTerm('')}
                    />
                  </div>
                </Toolbar>
              )}
              <div className="min-h-0 flex-1 overflow-auto">
                {!selectedSnapshot ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="No form connected"
                    description={
                      <>
                        Call{' '}
                        <code className="text-foreground">
                          useRozeniteRHFPlugin({'{ control }'})
                        </code>{' '}
                        in your form component to inspect it here.
                      </>
                    }
                  />
                ) : fieldRows.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="No fields found"
                    description={
                      searchTerm
                        ? 'Try adjusting your search.'
                        : 'This form has no registered fields.'
                    }
                  />
                ) : (
                  <FieldTable
                    rows={fieldRows}
                    snapshot={selectedSnapshot}
                    onSelect={setSelectedFieldName}
                  />
                )}
              </div>
              {selectedSnapshot && (
                <footer className="shrink-0 border-t border-border bg-card px-3 py-2">
                  <FormStateBadges formState={selectedSnapshot.formState} />
                </footer>
              )}
            </div>
          </Split.Pane>
        </Split>
      </PluginShell.Body>

      <FieldDetailDialog
        open={selectedFieldName !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedFieldName(null);
        }}
        name={selectedFieldName}
        snapshot={selectedSnapshot}
      />

      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        variant="confirm"
        destructive
        title="Reset Form"
        description={
          selectedFormId
            ? `Are you sure you want to reset "${selectedFormId}" to its default values? This action cannot be undone.`
            : undefined
        }
        confirmLabel="Reset"
        onConfirm={handleResetForm}
      />
    </PluginShell>
  );
}

export default function ReactHookFormPanel() {
  return (
    <Toast.Provider>
      <ReactHookFormPanelContent />
    </Toast.Provider>
  );
}
