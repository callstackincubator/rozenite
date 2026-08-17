import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  PluginShell,
  Sidebar,
  Split,
  Toolbar,
  VirtualizedDataTable,
} from '@rozenite/ui';
import {
  Download,
  File as FileIcon,
  FileText,
  Folder,
  FolderX,
  HardDrive,
  Image as ImageIcon,
  RefreshCw,
  Upload,
} from 'lucide-react';
import type { FileSystemEventMap, FsEntry } from './shared/protocol';
import { PLUGIN_ID } from './shared/protocol';
import { isLikelyImageFile, isLikelyTextFile } from './shared/path';
import { useFileSystemRequests } from './use-file-system-requests';
import { useFileSystemNavigation } from './use-file-system-navigation';
import { useFileSystemTree } from './use-file-system-tree';
import { FileTree } from './ui/FileTree';
import { DetailPane } from './ui/DetailPane';
import { downloadBase64File, formatBytes, formatDate, readFileAsBase64 } from './utils';
import './ui/globals.css';

type PendingOverwrite = { file: File; base64: string };

function getEntryIcon(entry: FsEntry) {
  if (entry.isDirectory) return Folder;
  if (isLikelyImageFile(entry.path)) return ImageIcon;
  if (isLikelyTextFile(entry.path)) return FileText;
  return FileIcon;
}

function FileSystemPanelContent() {
  const client = useRozeniteDevToolsClient<FileSystemEventMap>({
    pluginId: PLUGIN_ID,
  });

  const requests = useFileSystemRequests(client);
  const nav = useFileSystemNavigation(client, requests);
  const tree = useFileSystemTree(requests);

  const [selected, setSelected] = useState<FsEntry | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [exportingPaths, setExportingPaths] = useState<Set<string>>(new Set());
  const [transferError, setTransferError] = useState<string | null>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState<PendingOverwrite | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clear selection when the directory changes (preserves original loadDir behavior).
  useEffect(() => {
    setSelected(null);
  }, [nav.currentPath]);

  // Reconnect handling: reset UI-only state that isn't already owned by `nav`.
  useEffect(() => {
    if (!client) return;
    const subscription = client.onMessage('fs:ready', () => {
      tree.reset();
      setSelected(null);
      setImportLoading(false);
      setExportingPaths(new Set());
      setTransferError(null);
      setPendingOverwrite(null);
    });
    return () => {
      subscription.remove();
    };
    // Deliberately excludes `tree`: it's a new object each render, and its
    // `reset` callback is already stable — only `client` should retrigger this.
  }, [client]);

  const onSelectEntry = useCallback(
    (entry: FsEntry) => {
      if (entry.isDirectory) {
        nav.setCurrentPath(entry.path);
        return;
      }
      setSelected(entry);
    },
    [nav.setCurrentPath],
  );

  const onSelectTreeDir = useCallback(
    (path: string) => {
      nav.setCurrentPath(path);
    },
    [nav.setCurrentPath],
  );

  const onReload = useCallback(() => {
    nav.onReload();
    if (nav.currentPath) {
      tree.invalidate(nav.currentPath);
    }
  }, [nav, tree]);

  const importSelectedFile = useCallback(
    async (file: File) => {
      if (!nav.currentPath) return;

      setTransferError(null);
      setImportLoading(true);

      try {
        const base64 = await readFileAsBase64(file);
        const res = await requests.requestImportFile(nav.currentPath, file.name, base64, false);
        if (!res) return;

        if (res.overwriteRequired) {
          setPendingOverwrite({ file, base64 });
          return;
        }

        if (res.error) {
          setTransferError(res.error);
          return;
        }

        nav.onReload();
        tree.invalidate(nav.currentPath);
        if (res.entry) {
          setSelected(res.entry);
        }
      } catch (e) {
        setTransferError(e instanceof Error ? e.message : String(e));
      } finally {
        setImportLoading(false);
      }
    },
    [nav, requests.requestImportFile, tree],
  );

  const confirmOverwrite = useCallback(async () => {
    if (!pendingOverwrite || !nav.currentPath) return;
    const { file, base64 } = pendingOverwrite;
    setPendingOverwrite(null);
    setTransferError(null);
    setImportLoading(true);

    try {
      const res = await requests.requestImportFile(nav.currentPath, file.name, base64, true);
      if (!res) return;

      if (res.error) {
        setTransferError(res.error);
        return;
      }

      nav.onReload();
      tree.invalidate(nav.currentPath);
      if (res.entry) {
        setSelected(res.entry);
      }
    } catch (e) {
      setTransferError(e instanceof Error ? e.message : String(e));
    } finally {
      setImportLoading(false);
    }
  }, [pendingOverwrite, nav, requests.requestImportFile, tree]);

  const canImport = Boolean(nav.fileTransfer.import && nav.currentPath && !importLoading);

  const onImportClick = useCallback(() => {
    if (!canImport || !fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  }, [canImport]);

  const onFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      void importSelectedFile(file);
    },
    [importSelectedFile],
  );

  const onExport = useCallback(
    async (entry: FsEntry) => {
      if (entry.isDirectory || !nav.fileTransfer.export) return;

      setTransferError(null);
      setExportingPaths((current) => new Set(current).add(entry.path));

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
        const didDownload = downloadBase64File(res.fileName, res.base64, res.mime);
        if (!didDownload) {
          setTransferError('Failed to download exported file.');
        }
      } catch (e) {
        setTransferError(e instanceof Error ? e.message : String(e));
      } finally {
        setExportingPaths((current) => {
          const next = new Set(current);
          next.delete(entry.path);
          return next;
        });
      }
    },
    [nav.fileTransfer.export, requests.requestExportFile],
  );

  const columns = useMemo<ColumnDef<FsEntry>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => {
          const entry = row.original;
          const Icon = getEntryIcon(entry);
          return (
            <span className="flex min-w-0 items-center gap-2">
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-foreground" title={entry.name}>
                {entry.name}
              </span>
            </span>
          );
        },
      },
      {
        id: 'size',
        accessorKey: 'size',
        header: 'Size',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.isDirectory ? '—' : formatBytes(row.original.size)}
          </span>
        ),
      },
      {
        id: 'modified',
        accessorKey: 'modifiedAtMs',
        header: 'Modified',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatDate(row.original.modifiedAtMs)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const entry = row.original;
          if (entry.isDirectory) return null;
          const exporting = exportingPaths.has(entry.path);
          return (
            <div onClick={(event) => event.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onExport(entry)}
                disabled={!nav.fileTransfer.export || exporting}
                aria-label={exporting ? `Exporting ${entry.name}` : `Export ${entry.name}`}
                title={exporting ? 'Exporting…' : 'Export'}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [exportingPaths, nav.fileTransfer.export, onExport],
  );

  if (!client) {
    return (
      <PluginShell>
        <PluginShell.Body>
          <EmptyState
            icon={HardDrive}
            title="Connecting to device…"
            description="Waiting for the app to report its file system."
          />
        </PluginShell.Body>
      </PluginShell>
    );
  }

  return (
    <PluginShell>
      <PluginShell.Body>
        {nav.roots.length === 0 ? (
          <EmptyState
            icon={FolderX}
            title="No file system roots"
            description={nav.error ?? 'Waiting for the app to report its file system roots.'}
          />
        ) : (
          <Split direction="horizontal" autoSaveId="file-system">
            <Split.Pane defaultSize={22} minSize={15} maxSize={40}>
              <Sidebar className="w-full border-r-0">
                <FileTree
                  roots={nav.roots}
                  activePath={nav.currentPath}
                  tree={tree}
                  onSelectDir={onSelectTreeDir}
                />
              </Sidebar>
            </Split.Pane>
            <Split.Handle />
            <Split.Pane defaultSize={48} minSize={25}>
              <div className="flex h-full min-h-0 flex-col">
                <Toolbar>
                  <Toolbar.Group>
                    <Toolbar.Button
                      onClick={onReload}
                      disabled={!nav.currentPath || nav.loading}
                      aria-label="Reload directory"
                      title="Reload directory"
                      className="w-7 px-0"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Toolbar.Button>
                  </Toolbar.Group>
                  <Toolbar.Separator />
                  <span
                    className="min-w-0 flex-1 truncate px-1 font-mono text-xs text-muted-foreground"
                    title={nav.currentPath}
                  >
                    {nav.currentPath || '—'}
                  </span>
                  <Toolbar.Separator />
                  <Toolbar.Group>
                    <Toolbar.Button
                      onClick={onImportClick}
                      disabled={!canImport}
                      aria-label={importLoading ? 'Importing file' : 'Import file'}
                      title={importLoading ? 'Importing file' : 'Import file'}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {importLoading ? 'Importing…' : 'Import'}
                    </Toolbar.Button>
                  </Toolbar.Group>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={onFileInputChange}
                  />
                </Toolbar>
                {nav.error || transferError ? (
                  <p
                    role="alert"
                    className="border-b border-border px-3 py-2 text-xs text-destructive"
                  >
                    {nav.error ?? transferError}
                  </p>
                ) : null}
                <div className="min-h-0 flex-1 overflow-auto">
                  <VirtualizedDataTable
                    ariaLabel="Directory entries"
                    columns={columns}
                    data={nav.entries}
                    getRowId={(entry) => entry.path}
                    getRowTextValue={(entry) => entry.name}
                    loading={nav.loading}
                    emptyMessage="This directory is empty."
                    onRowClick={onSelectEntry}
                    scrollClassName="h-full w-full overflow-auto"
                    style={{ height: '100%' }}
                  />
                </div>
              </div>
            </Split.Pane>
            <Split.Handle />
            <Split.Pane defaultSize={30} minSize={20} maxSize={50}>
              <DetailPane
                selected={selected}
                canExport={Boolean(selected) && !selected?.isDirectory && nav.fileTransfer.export}
                exporting={Boolean(selected && exportingPaths.has(selected.path))}
                requestImagePreview={requests.requestImagePreview}
                requestTextPreview={requests.requestTextPreview}
                onExport={onExport}
              />
            </Split.Pane>
          </Split>
        )}
      </PluginShell.Body>
      <ConfirmDialog
        open={pendingOverwrite !== null}
        onOpenChange={(open) => {
          if (!open) setPendingOverwrite(null);
        }}
        variant="confirm"
        title="Overwrite file?"
        description={
          pendingOverwrite
            ? `"${pendingOverwrite.file.name}" already exists in this folder. Overwrite it?`
            : undefined
        }
        confirmLabel="Overwrite"
        onConfirm={() => void confirmOverwrite()}
      />
    </PluginShell>
  );
}

export default function FileSystemPanel() {
  return <FileSystemPanelContent />;
}
