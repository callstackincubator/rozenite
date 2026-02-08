import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Image,
} from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const reactLogoPng = require('../../assets/react.png');

interface SaveLocation {
  id: string;
  label: string;
  path: string;
}

interface SavedFile {
  name: string;
  path: string;
  size: number;
}

function getSaveLocations(): SaveLocation[] {
  const locations: SaveLocation[] = [
    {
      id: 'rnfs.DocumentDirectoryPath',
      label: 'Document Directory',
      path: RNFS.DocumentDirectoryPath,
    },
    {
      id: 'rnfs.CachesDirectoryPath',
      label: 'Caches Directory',
      path: RNFS.CachesDirectoryPath,
    },
    {
      id: 'rnfs.TemporaryDirectoryPath',
      label: 'Temporary Directory',
      path: RNFS.TemporaryDirectoryPath,
    },
    {
      id: 'rnfs.LibraryDirectoryPath',
      label: 'Library Directory',
      path: RNFS.LibraryDirectoryPath,
    },
  ];

  return locations;
}

export const FileSystemTestScreen = () => {
  const locations = getSaveLocations();
  const [selectedLocation, setSelectedLocation] = useState<SaveLocation>(
    locations[0]!,
  );
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshFiles = useCallback(async () => {
    try {
      const dirPath = selectedLocation.path.endsWith('/')
        ? selectedLocation.path.slice(0, -1)
        : selectedLocation.path;
      const items = await RNFS.readDir(dirPath);
      const pngFiles = items
        .filter((item: any) => item.isFile() && item.name.endsWith('.png'))
        .map((item: any) => ({
          name: item.name,
          path: item.path,
          size: item.size,
        }));
      setSavedFiles(pngFiles);
    } catch (error) {
      console.error('Error reading directory:', error);
      setSavedFiles([]);
    }
  }, [selectedLocation]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `react-logo-${timestamp}.png`;
      const dirPath = selectedLocation.path.endsWith('/')
        ? selectedLocation.path.slice(0, -1)
        : selectedLocation.path;
      const destPath = `${dirPath}/${fileName}`;

      // Resolve the bundled asset URI
      const asset = Image.resolveAssetSource(reactLogoPng);
      const uri = asset.uri;

      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        // Dev mode: Metro serves assets over HTTP
        const result = await RNFS.downloadFile({
          fromUrl: uri,
          toFile: destPath,
        }).promise;
        if (result.statusCode !== 200) {
          throw new Error(`Download failed with status ${result.statusCode}`);
        }
      } else {
        // Release mode: asset is a local file
        const sourcePath = uri.startsWith('file://') ? uri.slice(7) : uri;
        await RNFS.copyFile(sourcePath, destPath);
      }

      Alert.alert('Saved', `File saved as ${fileName}`);
      await refreshFiles();
    } catch (error) {
      Alert.alert('Error', `Failed to save file: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation, refreshFiles]);

  const handleRemove = useCallback(
    async (file: SavedFile) => {
      Alert.alert(
        'Confirm Delete',
        `Are you sure you want to delete "${file.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await RNFS.unlink(file.path);
                Alert.alert('Deleted', `${file.name} removed`);
                await refreshFiles();
              } catch (error) {
                Alert.alert('Error', `Failed to delete file: ${error}`);
              }
            },
          },
        ],
      );
    },
    [refreshFiles],
  );

  const handleRemoveAll = useCallback(async () => {
    if (savedFiles.length === 0) return;

    Alert.alert(
      'Confirm Delete All',
      `Are you sure you want to delete all ${savedFiles.length} PNG files?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(savedFiles.map((f) => RNFS.unlink(f.path)));
              Alert.alert('Deleted', 'All PNG files removed');
              await refreshFiles();
            } catch (error) {
              Alert.alert('Error', `Failed to delete files: ${error}`);
            }
          },
        },
      ],
    );
  }, [savedFiles, refreshFiles]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderFile = ({ item }: { item: SavedFile }) => (
    <View style={styles.fileCard}>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.fileSize}>{formatBytes(item.size)}</Text>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemove(item)}
      >
        <Text style={styles.removeButtonText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>File System Plugin</Text>
        <Text style={styles.subtitle}>
          Save and manage files across device directories
        </Text>
      </View>

      {/* Location selector */}
      <View style={styles.locationSection}>
        <Text style={styles.sectionLabel}>Save Location</Text>
        <View style={styles.locationTabs}>
          {locations.map((loc) => (
            <TouchableOpacity
              key={loc.id}
              style={[
                styles.locationTab,
                selectedLocation.id === loc.id && styles.selectedLocationTab,
              ]}
              onPress={() => setSelectedLocation(loc)}
            >
              <Text
                style={[
                  styles.locationTabText,
                  selectedLocation.id === loc.id &&
                    styles.selectedLocationTabText,
                ]}
                numberOfLines={1}
              >
                {loc.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.saveBtn,
            loading && styles.disabledBtn,
          ]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text
            style={styles.actionBtnText}
          >
            {loading ? 'Saving...' : 'Save React Logo'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.removeAllBtn,
            savedFiles.length === 0 && styles.disabledBtn,
          ]}
          onPress={handleRemoveAll}
          disabled={savedFiles.length === 0}
        >
          <Text
            style={[
              styles.actionBtnText,
              savedFiles.length === 0 && styles.disabledBtnText,
            ]}
          >
            Remove All
          </Text>
        </TouchableOpacity>
      </View>

      {/* File list */}
      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            PNG Files ({savedFiles.length})
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={refreshFiles}>
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {savedFiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No PNG files found</Text>
            <Text style={styles.emptyStateSubtext}>
              Tap "Save React Logo" to write a file to the selected directory
            </Text>
          </View>
        ) : (
          <FlatList
            data={savedFiles}
            renderItem={renderFile}
            keyExtractor={(item) => item.path}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    textAlign: 'center',
    lineHeight: 24,
  },
  locationSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a0a0a0',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationTab: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
  },
  selectedLocationTab: {
    backgroundColor: '#8232FF',
    borderColor: '#8232FF',
  },
  locationTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  selectedLocationTabText: {
    color: '#ffffff',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: '#8232FF',
    shadowColor: '#8232FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  removeAllBtn: {
    backgroundColor: '#ff6b6b',
  },
  disabledBtn: {
    backgroundColor: '#333333',
    shadowOpacity: 0,
    elevation: 0,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledBtnText: {
    color: '#666666',
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  refreshBtn: {
    backgroundColor: '#666666',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  refreshBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    paddingVertical: 4,
  },
  fileCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileInfo: {
    flex: 1,
    marginRight: 12,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    color: '#a0a0a0',
  },
  removeButton: {
    backgroundColor: '#ff6b6b',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  separator: {
    height: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});
