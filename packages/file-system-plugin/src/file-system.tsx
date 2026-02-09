import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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

export default function FileSystemPanel() {
  const client = useRozeniteDevToolsClient<FileSystemEventMap>({
    pluginId: PLUGIN_ID,
  });

  const requests = useFileSystemRequests(client);
  const nav = useFileSystemNavigation(client, requests);

  const [selected, setSelected] = useState<FsEntry | null>(null);

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
          </View>

          {nav.error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Error</Text>
              <Text style={styles.errorText}>{nav.error}</Text>
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
          requestImagePreview={requests.requestImagePreview}
          requestTextPreview={requests.requestTextPreview}
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
