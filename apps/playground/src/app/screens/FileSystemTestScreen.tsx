import { useState, useCallback, useEffect } from 'react';
import { Alert, FlatList, Image } from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { Button, EmptyState, ListItem, PluginHeader, Row, Screen } from '../components/ui';

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
  return [
    {
      id: 'rnfs.DocumentDirectoryPath',
      label: 'Documents',
      path: RNFS.DocumentDirectoryPath,
    },
    {
      id: 'rnfs.CachesDirectoryPath',
      label: 'Caches',
      path: RNFS.CachesDirectoryPath,
    },
    {
      id: 'rnfs.TemporaryDirectoryPath',
      label: 'Temporary',
      path: RNFS.TemporaryDirectoryPath,
    },
    RNFS.LibraryDirectoryPath
      ? {
          id: 'rnfs.LibraryDirectoryPath',
          label: 'Library',
          path: RNFS.LibraryDirectoryPath,
        }
      : null,
  ].filter((location): location is SaveLocation => location !== null);
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const FileSystemTestScreen = () => {
  const locations = getSaveLocations();
  const [selectedLocation, setSelectedLocation] = useState<SaveLocation>(locations[0]!);
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

      const asset = Image.resolveAssetSource(reactLogoPng);
      const uri = asset.uri;

      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        const result = await RNFS.downloadFile({
          fromUrl: uri,
          toFile: destPath,
        }).promise;
        if (result.statusCode !== 200) {
          throw new Error(`Download failed with status ${result.statusCode}`);
        }
      } else {
        const sourcePath = uri.startsWith('file://') ? uri.slice(7) : uri;
        await RNFS.copyFile(sourcePath, destPath);
      }

      await refreshFiles();
    } catch (error) {
      Alert.alert('Error', `Failed to save file: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation, refreshFiles]);

  const handleRemove = useCallback(
    async (file: SavedFile) => {
      try {
        await RNFS.unlink(file.path);
        await refreshFiles();
      } catch (error) {
        Alert.alert('Error', `Failed to delete file: ${error}`);
      }
    },
    [refreshFiles],
  );

  return (
    <Screen scroll={false}>
      <PluginHeader
        title="File System"
        subtitle="Save and manage files across device directories."
      />

      <Row wrap>
        {locations.map((location) => (
          <Button
            key={location.id}
            label={location.label}
            accessibilityLabel={`Select ${location.label} directory`}
            size="compact"
            variant={selectedLocation.id === location.id ? 'default' : 'secondary'}
            onPress={() => setSelectedLocation(location)}
          />
        ))}
      </Row>

      <Row>
        <Button
          label={loading ? 'Saving…' : 'Save react logo'}
          disabled={loading}
          onPress={() => void handleSave()}
        />
        <Button label="Refresh" variant="secondary" onPress={() => void refreshFiles()} />
      </Row>

      <FlatList
        style={{ flex: 1 }}
        data={savedFiles}
        keyExtractor={(item) => item.path}
        renderItem={({ item }) => (
          <ListItem
            label={item.name}
            description={formatBytes(item.size)}
            accessibilityLabel={`Remove ${item.name}`}
            onPress={() => void handleRemove(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState title="No PNG files" description="Save the react logo to write a file." />
        }
      />
    </Screen>
  );
};
