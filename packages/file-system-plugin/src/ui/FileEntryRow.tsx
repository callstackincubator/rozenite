import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FsEntry } from '../shared/protocol';
import { isLikelyImageFile, isLikelyTextFile } from '../shared/path';
import { formatBytes, formatDate } from '../utils';
import type { WebPressableState } from '../types';

type FileEntryRowProps = {
  entry: FsEntry;
  isSelected: boolean;
  onPress: (entry: FsEntry) => void;
};

function getFileIcon(entry: FsEntry): string {
  if (entry.isDirectory) return '📁';
  if (isLikelyImageFile(entry.path)) return '🖼️';
  if (isLikelyTextFile(entry.path)) return '📝';
  return '📄';
}

function FileEntryRowInner({ entry, isSelected, onPress }: FileEntryRowProps) {
  return (
    <Pressable
      onPress={() => onPress(entry)}
      style={(state: WebPressableState) => [
        styles.row,
        state.hovered && !isSelected && styles.rowHovered,
        isSelected ? styles.rowSelected : undefined,
      ]}
    >
      <Text style={styles.rowIcon}>{getFileIcon(entry)}</Text>
      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={1}>
          {entry.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {entry.isDirectory
            ? 'Directory'
            : `${formatBytes(entry.size)} • ${formatDate(entry.modifiedAtMs)}`}
        </Text>
      </View>
      <Text style={styles.rowChevron}>{entry.isDirectory ? '›' : ''}</Text>
    </Pressable>
  );
}

export const FileEntryRow = React.memo(FileEntryRowInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowHovered: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  rowSelected: {
    backgroundColor: 'rgba(130, 50, 255, 0.12)',
  },
  rowIcon: {
    width: 24,
    textAlign: 'center',
    fontSize: 16,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    color: '#f2f2f2',
    fontSize: 13,
    fontWeight: '600',
  },
  rowMeta: {
    color: '#9a9aa7',
    fontSize: 11,
  },
  rowChevron: {
    color: '#6f6f7e',
    fontSize: 18,
    paddingLeft: 6,
  },
});
