import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  Button,
  Chip,
  Input,
  ListBox,
  PluginHeader,
  PluginTheme,
  Select,
  Surface,
  TextField,
} from '@rozenite/ui';
import { ArrowLeft, Loader2, RefreshCcw } from 'lucide-react';
import type { FileSystemEventMap, FsEntry } from './shared/protocol';
import { PLUGIN_ID } from './shared/protocol';
import { useFileSystemNavigation } from './use-file-system-navigation';
import { useFileSystemRequests } from './use-file-system-requests';
import { ConnectingScreen } from './ui/ConnectingScreen';
import { DetailPanel } from './ui/DetailPanel';
import { FileEntryTable } from './ui/FileEntryTable';
import { PathDisplay } from './ui/PathDisplay';
import { downloadBase64File, readFileAsBase64 } from './utils';
import './ui/globals.css';

function getProviderLabel(provider: string): string {
  if (provider === 'expo') {
    return 'Expo FileSystem';
  }

  if (provider === 'rnfs') {
    return 'react-native-fs';
  }

  return 'No provider';
}

export default function FileSystemPanel() {
  const client = useRozeniteDevToolsClient<FileSystemEventMap>({
    pluginId: PLUGIN_ID,
  });

  const requests = useFileSystemRequests(client);
  const nav = useFileSystemNavigation(client, requests);

  const [selected, setSelected] = useState<FsEntry | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [nav.currentPath]);

  const activeRootId = useMemo(() => {
    let nextRootId: string | null = null;
    let matchedPathLength = -1;

    nav.roots.forEach((root) => {
      const isMatch =
        nav.currentPath === root.path || nav.currentPath.startsWith(root.path);

      if (isMatch && root.path.length > matchedPathLength) {
        nextRootId = root.id;
        matchedPathLength = root.path.length;
      }
    });

    return nextRootId ?? '';
  }, [nav.currentPath, nav.roots]);

  const onSelectEntry = useCallback(
    (entry: FsEntry) => {
      if (entry.isDirectory) {
        setSelected(null);
        nav.setCurrentPath(entry.path);
        return;
      }

      setSelected(entry);
    },
    [nav.setCurrentPath],
  );

  const importSelectedFile = useCallback(
    async (file: File, overwrite = false) => {
      if (!nav.currentPath) return;

      setTransferError(null);
      setImportLoading(true);

      try {
        const base64 = await readFileAsBase64(file);
        const res = await requests.requestImportFile(
          nav.currentPath,
          file.name,
          base64,
          overwrite,
        );

        if (!res) return;

        if (res.overwriteRequired) {
          const shouldOverwrite = window.confirm(
            `"${file.name}" already exists. Overwrite it?`,
          );
          if (shouldOverwrite) {
            const overwriteRes = await requests.requestImportFile(
              nav.currentPath,
              file.name,
              base64,
              true,
            );
            if (overwriteRes?.error) {
              setTransferError(overwriteRes.error);
              return;
            }
            nav.onReload();
            if (overwriteRes?.entry) {
              setSelected(overwriteRes.entry);
            }
          }
          return;
        }

        if (res.error) {
          setTransferError(res.error);
          return;
        }

        nav.onReload();
        if (res.entry) {
          setSelected(res.entry);
        }
      } catch (e) {
        setTransferError(e instanceof Error ? e.message : String(e));
      } finally {
        setImportLoading(false);
      }
    },
    [nav.currentPath, nav.onReload, requests.requestImportFile],
  );

  const onImport = useCallback(() => {
    if (!nav.currentPath || !nav.fileTransfer.import || importLoading) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    const removeInput = () => {
      if (input.parentNode) {
        document.body.removeChild(input);
      }
    };
    input.onchange = () => {
      const file = input.files?.[0];
      removeInput();
      if (!file) return;
      void importSelectedFile(file);
    };
    input.addEventListener('cancel', removeInput);
    document.body.appendChild(input);
    input.click();
  }, [
    importLoading,
    importSelectedFile,
    nav.currentPath,
    nav.fileTransfer.import,
  ]);

  const onExport = useCallback(
    async (entry: FsEntry) => {
      if (entry.isDirectory || !nav.fileTransfer.export) return;

      setTransferError(null);
      setExportPath(entry.path);

      try {
        const res = await requests.requestExportFile(entry.path);
        if (!res) return;
        if (res.error) {
          setTransferError(res.error);
          return;
        }
        if (res.base64 == null || !res.fileName) {
          setTransferError('Export did not return file contents.');
          return;
        }
        const didDownload = downloadBase64File(
          res.fileName,
          res.base64,
          res.mime,
        );
        if (!didDownload) {
          setTransferError('Failed to download exported file.');
        }
      } catch (e) {
        setTransferError(e instanceof Error ? e.message : String(e));
      } finally {
        setExportPath(null);
      }
    },
    [nav.fileTransfer.export, requests.requestExportFile],
  );

  return (
    <PluginTheme
      className="flex h-screen flex-col bg-background text-foreground"
      defaultTheme="dark"
    >
      <PluginHeader
        subtitle="Browse app files and preview contents in React Native DevTools."
        title="File System"
        actions={
          <div className="flex items-center gap-2">
            <Chip className="shrink-0" variant="secondary">
              {getProviderLabel(nav.provider)}
            </Chip>
            <div className="w-56 max-w-[44vw] min-w-40">
              <Select
                isDisabled={nav.roots.length === 0}
                onChange={(value) => {
                  const rootId =
                    typeof value === 'string'
                      ? value
                      : value == null
                        ? null
                        : String(value);

                  if (!rootId) {
                    return;
                  }

                  const root = nav.roots.find((item) => item.id === rootId);
                  if (!root) {
                    return;
                  }

                  nav.setCurrentPath(root.path);
                }}
                placeholder="Select root"
                value={activeRootId}
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox aria-label="Root directories">
                    {nav.roots.map((root) => (
                      <ListBox.Item
                        id={root.id}
                        key={root.id}
                        textValue={root.label}
                      >
                        {root.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          </div>
        }
      />

      <div className="flex items-center gap-2 px-3 pb-3 pt-3">
        <Button
          aria-label="Go to parent directory"
          isDisabled={!client || !nav.canGoBack}
          isIconOnly
          onPress={nav.onBack}
          size="sm"
          variant="secondary"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <Button
          aria-label="Reload current directory"
          isDisabled={!client || !nav.currentPath}
          isIconOnly
          onPress={nav.onReload}
          size="sm"
          variant="secondary"
        >
          <RefreshCcw className="size-4" />
        </Button>
        <TextField aria-label="Directory path" className="min-w-0 flex-1">
          <Input
            disabled={!client}
            fullWidth
            onChange={(event) => nav.setPathInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                nav.onGo();
              }
            }}
            placeholder="Enter a directory path..."
            value={nav.pathInput}
            variant="secondary"
          />
        </TextField>
        <Button
          isDisabled={!client || !nav.pathInput.trim()}
          onPress={nav.onGo}
          size="sm"
        >
          Go
        </Button>
        {nav.fileTransfer.import ? (
          <Button
            isDisabled={!client || !nav.currentPath || importLoading}
            onPress={onImport}
            size="sm"
            variant="secondary"
          >
            {importLoading ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Importing...
              </>
            ) : (
              'Import'
            )}
          </Button>
        ) : null}
      </div>

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-3 pt-0 lg:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-[3]">
          {nav.currentPath ? (
            <Surface
              className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface px-3 py-3"
              variant="secondary"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Chip className="shrink-0" variant="secondary">
                  {nav.entries.length} items
                </Chip>
                {nav.loading ? (
                  <Chip className="shrink-0" variant="secondary">
                    <Loader2 className="size-3 animate-spin" />
                    Loading
                  </Chip>
                ) : null}
              </div>
              <PathDisplay label="Current path" path={nav.currentPath} />
            </Surface>
          ) : null}

          {nav.error ? (
            <Surface
              className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-4 text-sm text-danger"
              variant="secondary"
            >
              <div className="font-medium">Error loading directory</div>
              <div className="mt-1">{nav.error}</div>
            </Surface>
          ) : null}

          {transferError ? (
            <Surface
              className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-4 text-sm text-danger"
              variant="secondary"
            >
              <div className="font-medium">Transfer error</div>
              <div className="mt-1">{transferError}</div>
            </Surface>
          ) : null}

          {!client ? (
            <ConnectingScreen />
          ) : nav.currentPath ? (
            <div className="min-h-0 flex-1">
              <FileEntryTable
                entries={nav.entries}
                loading={nav.loading}
                onEntryPress={onSelectEntry}
                selectedPath={selected?.path ?? null}
              />
            </div>
          ) : nav.roots.length === 0 ? (
            <Surface
              className="flex min-h-48 items-center justify-center rounded-xl border border-border/70 bg-surface px-4 py-8 text-center text-sm text-muted"
              variant="secondary"
            >
              No filesystem roots were reported by the active provider.
            </Surface>
          ) : (
            <ConnectingScreen
              description="Initializing the browser for the selected provider."
              message="Loading filesystem roots..."
            />
          )}
        </section>

        <section className="flex min-h-0 min-w-0 flex-1 overflow-hidden lg:flex-[2]">
          <DetailPanel
            canExport={
              Boolean(selected) &&
              !selected?.isDirectory &&
              nav.fileTransfer.export
            }
            exportLoading={Boolean(selected && exportPath === selected.path)}
            onExport={onExport}
            requestImagePreview={requests.requestImagePreview}
            requestTextPreview={requests.requestTextPreview}
            selected={selected}
          />
        </section>
      </main>
    </PluginTheme>
  );
}
