import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type { FileSystemEventMap, FsEntry } from './shared/protocol';
import { PLUGIN_ID } from './shared/protocol';
import { useFileSystemRequests } from './use-file-system-requests';
import { useFileSystemNavigation } from './use-file-system-navigation';
import { ConnectingScreen } from './ui/ConnectingScreen';
import { TopBar } from './ui/TopBar';
import { FileEntryRow } from './ui/FileEntryRow';
import { DetailPanel } from './ui/DetailPanel';
import { PathDisplay } from './ui/PathDisplay';
import { downloadBase64File, readFileAsBase64 } from './utils';
import type { WebPressableState } from './types';

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

  // Clear selection when the directory changes (preserves original loadDir behavior)
  useEffect(() => {
    setSelected(null);
  }, [nav.currentPath]);

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

  const renderItem = useCallback(
    ({ item }: { item: FsEntry }) => (
      <FileEntryRow
        entry={item}
        isSelected={selected?.path === item.path}
        onPress={onSelectEntry}
      />
    ),
    [selected?.path, onSelectEntry],
  );

  const keyExtractor = useCallback((item: FsEntry) => item.path, []);

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

  if (!client) {
    return <ConnectingScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopBar
        provider={nav.provider}
        roots={nav.roots}
        pathInput={nav.pathInput}
        setPathInput={nav.setPathInput}
        currentPath={nav.currentPath}
        setCurrentPath={nav.setCurrentPath}
        canGoBack={nav.canGoBack}
        onGo={nav.onGo}
        onBack={nav.onBack}
        onReload={nav.onReload}
      />

      <View style={styles.body}>
        <View style={styles.listPane}>
          <View style={styles.listHeader}>
            {nav.currentPath ? (
              <PathDisplay path={nav.currentPath} />
            ) : (
              <Text style={styles.listHeaderTitle}>—</Text>
            )}
            {nav.loading ? <ActivityIndicator size="small" /> : null}
            <Pressable
              style={(state: WebPressableState) => [
                styles.importButton,
                state.hovered &&
                  nav.fileTransfer.import &&
                  !!nav.currentPath &&
                  !importLoading &&
                  styles.importButtonHovered,
                (!nav.fileTransfer.import ||
                  !nav.currentPath ||
                  importLoading) &&
                  styles.importButtonDisabled,
              ]}
              onPress={onImport}
              disabled={
                !nav.fileTransfer.import || !nav.currentPath || importLoading
              }
            >
              <Text style={styles.importButtonText}>
                {importLoading ? 'Importing…' : 'Import'}
              </Text>
            </Pressable>
          </View>

          {nav.error || transferError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Error</Text>
              <Text style={styles.errorText}>{nav.error ?? transferError}</Text>
            </View>
          ) : null}

          <FlatList
            data={nav.entries}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            renderItem={renderItem}
          />
        </View>

        <DetailPanel
          selected={selected}
          canExport={
            Boolean(selected) &&
            !selected?.isDirectory &&
            nav.fileTransfer.export
          }
          exportLoading={Boolean(selected && exportPath === selected.path)}
          requestImagePreview={requests.requestImagePreview}
          requestTextPreview={requests.requestTextPreview}
          onExport={onExport}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  listPane: {
    flex: 1.2,
    borderRightWidth: 1,
    borderRightColor: '#1c1c24',
  },
  listHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c24',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listHeaderTitle: {
    flex: 1,
    color: '#eaeaf2',
    fontSize: 12,
    fontFamily: 'Menlo',
  },
  importButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1b1c25',
    borderWidth: 1,
    borderColor: '#2a2b37',
  },
  importButtonHovered: {
    backgroundColor: '#252633',
  },
  importButtonDisabled: {
    opacity: 0.45,
  },
  importButtonText: {
    color: '#e9e9ee',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingVertical: 6,
  },
  errorBox: {
    margin: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 99, 132, 0.4)',
    backgroundColor: 'rgba(255, 99, 132, 0.08)',
    gap: 6,
  },
  errorTitle: {
    color: '#ffb3c1',
    fontWeight: '700',
  },
  errorText: {
    color: '#ffb3c1',
    fontSize: 12,
  },
});
