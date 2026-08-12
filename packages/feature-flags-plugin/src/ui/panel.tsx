import type { ColumnDef } from '@tanstack/react-table';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  PluginShell,
  SearchField,
  Sidebar,
  Split,
  Toast,
  Toolbar,
  useToast,
  VirtualizedDataTable,
} from '@rozenite/ui';
import { Flag, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { FeatureFlagsProviderSnapshot } from '../shared/messaging';
import type { FeatureFlag, FeatureFlagValue, JsonValue } from '../shared/types';
import { filterFlags } from './flag-filters';
import { FlagValueCell } from './flag-value-cell';
import { JsonFlagDialog } from './json-flag-dialog';
import { FeatureFlagsQueryClientProvider } from './query-client';
import { buildProviderSidebarItems } from './snapshot-helpers';
import { useFeatureFlags } from './use-feature-flags';
import './globals.css';

const SETUP_SNIPPET = `useRozeniteFeatureFlagsPlugin({
  providers: [
    createCustomFlagsAdapter({
      id: 'app',
      name: 'App flags',
      listFlags: () => flagStore.getAll(),
    }),
  ],
});`;

function FeatureFlagsPanelContent() {
  const {
    connected,
    snapshot,
    isLoading,
    isError,
    setOverride,
    clearOverride,
    clearAllOverrides,
    refresh,
  } = useFeatureFlags();
  const toast = useToast();
  const providers = snapshot?.providers ?? [];
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [overriddenOnly, setOverriddenOnly] = useState(false);
  const [jsonDialogKey, setJsonDialogKey] = useState<string | null>(null);
  const [showResetAllDialog, setShowResetAllDialog] = useState(false);

  useEffect(() => {
    setSelectedProviderId((current) =>
      current && providers.some((provider) => provider.id === current)
        ? current
        : (providers[0]?.id ?? null),
    );
  }, [providers]);

  const selectedProvider: FeatureFlagsProviderSnapshot | null =
    providers.find((provider) => provider.id === selectedProviderId) ?? providers[0] ?? null;
  const sidebarItems = buildProviderSidebarItems(providers);

  const notifyError = (title: string, error: unknown) => {
    toast.add({
      title,
      description: error instanceof Error ? error.message : String(error),
      type: 'error',
    });
  };

  const handleSetOverride = async (
    flag: FeatureFlag,
    value: FeatureFlagValue,
  ): Promise<boolean> => {
    if (!selectedProvider) return false;
    try {
      await setOverride(selectedProvider.id, flag.key, value);
      return true;
    } catch (error) {
      notifyError(`Could not override "${flag.key}"`, error);
      return false;
    }
  };

  const handleClearOverride = async (flag: FeatureFlag) => {
    if (!selectedProvider) return;
    try {
      await clearOverride(selectedProvider.id, flag.key);
    } catch (error) {
      notifyError(`Could not reset "${flag.key}"`, error);
    }
  };

  const handleClearAllOverrides = async () => {
    if (!selectedProvider) return;
    setShowResetAllDialog(false);
    try {
      await clearAllOverrides(selectedProvider.id);
    } catch (error) {
      notifyError('Could not reset all overrides', error);
    }
  };

  const handleRefresh = async () => {
    try {
      await refresh(selectedProvider?.id);
    } catch (error) {
      notifyError('Could not refresh flags', error);
    }
  };

  const jsonDialogFlag = selectedProvider?.flags.find((flag) => flag.key === jsonDialogKey) ?? null;

  // Not memoized: the dataset is tens to low hundreds of rows (design §6),
  // and these columns close over per-render handlers (`handleSetOverride`,
  // `handleClearOverride`), so memoizing them on `[connected,
  // selectedProvider?.id]` alone would keep stale closures around.
  const columns: ColumnDef<FeatureFlag>[] = [
    {
      id: 'key',
      accessorKey: 'key',
      header: 'Key',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-sm text-foreground">{row.original.key}</span>
          {row.original.overridden && <Badge variant="secondary">Overridden</Badge>}
        </div>
      ),
    },
    {
      id: 'type',
      accessorKey: 'type',
      header: 'Type',
      enableSorting: false,
      cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>,
    },
    {
      id: 'value',
      header: 'Value',
      enableSorting: false,
      cell: ({ row }) => (
        <FlagValueCell
          flag={row.original}
          disabled={!connected}
          onChange={(value) => handleSetOverride(row.original, value)}
          onOpenJson={() => setJsonDialogKey(row.original.key)}
        />
      ),
    },
    {
      id: 'reset',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          disabled={!connected || !row.original.overridden}
          onClick={() => handleClearOverride(row.original)}
          aria-label={`Reset ${row.original.key} to its default value`}
          title={`Reset ${row.original.key} to its default value`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  const rows = selectedProvider ? filterFlags(selectedProvider.flags, search, overriddenOnly) : [];
  const hasOverrides = selectedProvider?.flags.some((flag) => flag.overridden) ?? false;

  let body: ReactNode;

  if (selectedProvider && selectedProvider.flags.length === 0) {
    body = (
      <EmptyState
        icon={Flag}
        title="No flags declared"
        description={`"${selectedProvider.name}" is registered but its listFlags() returned no flags. Add flags there, or use "Refresh" if they're loaded asynchronously.`}
      />
    );
  } else {
    body = (
      <VirtualizedDataTable
        ariaLabel="Feature flags"
        columns={columns}
        data={rows}
        getRowId={(flag) => flag.key}
        getRowTextValue={(flag) => flag.key}
        loading={isLoading}
        emptyMessage={
          overriddenOnly || search ? 'No flags match your filters.' : 'No flags to show.'
        }
        scrollClassName="h-full w-full overflow-auto"
        style={{ height: '100%' }}
      />
    );
  }

  const toolbar = (
    <Toolbar>
      <div className="min-w-40 flex-1">
        <SearchField
          placeholder="Search flags…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          disabled={!selectedProvider}
        />
      </div>
      <Toolbar.Separator />
      <Toolbar.Group>
        <Toolbar.Button
          onClick={() => setOverriddenOnly((current) => !current)}
          aria-pressed={overriddenOnly}
          disabled={!selectedProvider}
          className={overriddenOnly ? 'bg-accent text-accent-foreground' : undefined}
        >
          Overridden only
        </Toolbar.Button>
      </Toolbar.Group>
      <Toolbar.Separator />
      <Toolbar.Group>
        <Toolbar.Button
          onClick={() => setShowResetAllDialog(true)}
          disabled={!connected || !selectedProvider || !hasOverrides}
          aria-label="Reset all overrides"
          title="Reset all overrides"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset all
        </Toolbar.Button>
        <Toolbar.Button
          onClick={() => void handleRefresh()}
          disabled={!connected || !selectedProvider}
          aria-label="Refresh flags"
          title="Refresh flags"
          className="w-7 px-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Toolbar.Button>
      </Toolbar.Group>
    </Toolbar>
  );

  const panelContent = (
    <div className="flex h-full min-h-0 flex-col">
      {toolbar}
      <div className="min-h-0 flex-1 overflow-auto">{body}</div>
    </div>
  );

  return (
    <PluginShell>
      <PluginShell.Body>
        {!connected || isLoading ? (
          <EmptyState
            icon={(iconProps) => (
              <Loader2 {...iconProps} className={`${iconProps.className ?? ''} animate-spin`} />
            )}
            title="Loading feature flags…"
          />
        ) : providers.length === 0 ? (
          <EmptyState
            icon={Flag}
            title="No providers registered"
            description={
              isError
                ? 'Could not load feature flags. Check the connection and try again.'
                : 'Call useRozeniteFeatureFlagsPlugin with at least one provider to see your flags here.'
            }
            action={
              <pre className="max-w-lg overflow-auto rounded-md border border-border bg-muted p-3 text-left font-mono text-xs text-foreground">
                {SETUP_SNIPPET}
              </pre>
            }
          />
        ) : providers.length > 1 ? (
          <Split direction="horizontal" autoSaveId="feature-flags">
            <Split.Pane defaultSize={22} minSize={15} maxSize={40}>
              <Sidebar className="w-full border-r-0">
                {sidebarItems.map((item) => (
                  <Sidebar.Group key={item.id} label={item.name}>
                    <Sidebar.Item
                      selected={item.id === selectedProvider?.id}
                      onClick={() => setSelectedProviderId(item.id)}
                      adornment={<Flag />}
                      trailing={
                        <Badge variant="secondary">
                          {item.overriddenCount > 0
                            ? `${item.overriddenCount}/${item.flagCount}`
                            : item.flagCount}
                        </Badge>
                      }
                    >
                      Flags
                    </Sidebar.Item>
                  </Sidebar.Group>
                ))}
              </Sidebar>
            </Split.Pane>
            <Split.Handle />
            <Split.Pane>{panelContent}</Split.Pane>
          </Split>
        ) : (
          panelContent
        )}
      </PluginShell.Body>
      <JsonFlagDialog
        open={jsonDialogKey != null}
        onOpenChange={(open) => {
          if (!open) setJsonDialogKey(null);
        }}
        flagKey={jsonDialogKey}
        value={(jsonDialogFlag?.value as JsonValue | null) ?? null}
        onSave={async (value) => {
          if (!jsonDialogFlag) return false;
          return handleSetOverride(jsonDialogFlag, value);
        }}
      />
      <ConfirmDialog
        open={showResetAllDialog}
        onOpenChange={setShowResetAllDialog}
        variant="confirm"
        destructive
        title="Reset all overrides"
        description={
          selectedProvider
            ? `Are you sure you want to clear every override for "${selectedProvider.name}"? This action cannot be undone.`
            : undefined
        }
        confirmLabel="Reset all"
        onConfirm={handleClearAllOverrides}
      />
    </PluginShell>
  );
}

export default function FeatureFlagsPanel() {
  return (
    <FeatureFlagsQueryClientProvider>
      <Toast.Provider>
        <FeatureFlagsPanelContent />
      </Toast.Provider>
    </FeatureFlagsQueryClientProvider>
  );
}
