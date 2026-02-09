import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { FileSystemProvider, FsRoots } from '../shared/protocol';
import type { WebPressableState } from '../types';

type TopBarProps = {
  provider: FileSystemProvider;
  roots: FsRoots['roots'];
  pathInput: string;
  setPathInput: (value: string) => void;
  currentPath: string;
  setCurrentPath: (path: string) => void;
  canGoBack: boolean;
  onGo: () => void;
  onBack: () => void;
  onReload: () => void;
};

function getProviderLabel(provider: FileSystemProvider): string {
  if (provider === 'expo') return 'Expo FileSystem';
  if (provider === 'rnfs') return 'react-native-fs';
  return 'No provider';
}

export function TopBar({
  provider,
  roots,
  pathInput,
  setPathInput,
  currentPath,
  setCurrentPath,
  canGoBack,
  onGo,
  onBack,
  onReload,
}: TopBarProps) {
  const rootChips = useMemo(() => {
    return roots.map((r) => {
      const isActive = r.path === currentPath;
      return (
        <Pressable
          key={r.id}
          style={(state: WebPressableState) => [
            styles.chip,
            state.hovered && !isActive && styles.chipHovered,
            isActive ? styles.chipActive : undefined,
          ]}
          onPress={() => setCurrentPath(r.path)}
        >
          <Text
            style={[
              styles.chipText,
              isActive ? styles.chipTextActive : undefined,
            ]}
            numberOfLines={1}
          >
            {r.label}
          </Text>
        </Pressable>
      );
    });
  }, [currentPath, roots, setCurrentPath]);

  return (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        <Text style={styles.title}>File System</Text>
        <Text style={styles.statusText}>{getProviderLabel(provider)}</Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <Pressable
            style={(state: WebPressableState) => [
              styles.iconButton,
              state.hovered && canGoBack && styles.iconButtonHovered,
              !canGoBack ? styles.buttonDisabled : null,
            ]}
            onPress={onBack}
            disabled={!canGoBack}
          >
            <Text style={styles.iconButtonText}>←</Text>
          </Pressable>

          <Pressable
            style={(state: WebPressableState) => [
              styles.iconButton,
              state.hovered && !!currentPath && styles.iconButtonHovered,
              !currentPath ? styles.buttonDisabled : null,
            ]}
            onPress={onReload}
            disabled={!currentPath}
          >
            <Text style={styles.iconButtonText}>↻</Text>
          </Pressable>

          <View style={styles.pathInputWrap}>
            <TextInput
              style={styles.pathInput}
              value={pathInput}
              onChangeText={setPathInput}
              placeholder="Enter a directory path…"
              placeholderTextColor="#8a8a8a"
              autoCorrect={false}
              autoCapitalize="none"
              onSubmitEditing={onGo}
            />
          </View>

          <Pressable
            style={(state: WebPressableState) => [
              styles.primaryButton,
              state.hovered && styles.primaryButtonHovered,
            ]}
            onPress={onGo}
          >
            <Text style={styles.primaryButtonText}>Go</Text>
          </Pressable>
        </View>

        <View style={styles.chipsRow}>{rootChips}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c24',
    backgroundColor: '#0f1016',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f2f2f2',
  },
  statusText: {
    fontSize: 12,
    color: '#9a9aa7',
  },
  controls: {
    gap: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1b1c25',
    borderWidth: 1,
    borderColor: '#2a2b37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonHovered: {
    backgroundColor: '#252633',
  },
  iconButtonText: {
    color: '#e9e9ee',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  primaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#8232ff',
  },
  primaryButtonHovered: {
    backgroundColor: '#9550ff',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  pathInputWrap: {
    flex: 1,
    minWidth: 240,
  },
  pathInput: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2b37',
    backgroundColor: '#0b0b0f',
    color: '#f2f2f2',
    fontSize: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#161723',
    borderWidth: 1,
    borderColor: '#2a2b37',
    maxWidth: 220,
  },
  chipHovered: {
    backgroundColor: '#1e1f2e',
    borderColor: '#3a3b4a',
  },
  chipActive: {
    borderColor: '#8232ff',
    backgroundColor: 'rgba(130, 50, 255, 0.14)',
  },
  chipText: {
    color: '#cfcfe0',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#efe7ff',
  },
});
