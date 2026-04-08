import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { FsEntry } from '../shared/protocol';
import { isLikelyImageFile } from '../shared/path';
import { formatBytes, formatDate } from '../utils';
import { formatTextPreview } from '../formatters';
import { DetailLine } from './DetailLine';
import { PathDisplay } from './PathDisplay';
import type { useFileSystemRequests } from '../use-file-system-requests';

type FileSystemRequests = ReturnType<typeof useFileSystemRequests>;

type DetailPanelProps = {
  selected: FsEntry | null;
  requestImagePreview: FileSystemRequests['requestImagePreview'];
  requestTextPreview: FileSystemRequests['requestTextPreview'];
};

export function DetailPanel({
  selected,
  requestImagePreview,
  requestTextPreview,
}: DetailPanelProps) {
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);
  const [imagePreviewError, setImagePreviewError] = useState<string | null>(
    null,
  );
  const [imagePreviewLoading, setImagePreviewLoading] = useState(false);

  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [textPreviewError, setTextPreviewError] = useState<string | null>(null);
  const [textPreviewLoading, setTextPreviewLoading] = useState(false);

  // Load preview when selected file changes
  const loadPreview = useCallback(
    async (entry: FsEntry) => {
      // Reset preview state
      setImagePreviewUri(null);
      setImagePreviewError(null);
      setImagePreviewLoading(false);
      setTextPreview(null);
      setTextPreviewError(null);
      setTextPreviewLoading(false);

      if (entry.isDirectory) return;

      // Handle image preview
      if (isLikelyImageFile(entry.path)) {
        setImagePreviewLoading(true);
        try {
          const res = await requestImagePreview(entry.path);
          if (!res) return;
          if (res.error || !res.dataUri) {
            setImagePreviewError(res.error ?? 'No preview available');
            return;
          }
          setImagePreviewUri(res.dataUri);
        } catch (e) {
          setImagePreviewError(e instanceof Error ? e.message : String(e));
        } finally {
          setImagePreviewLoading(false);
        }
        return;
      }

      // Handle text/file preview for any non-image file
      setTextPreviewLoading(true);
      try {
        const res = await requestTextPreview(entry.path);
        if (!res) return;
        if (res.error || !res.content) {
          setTextPreviewError(res.error ?? 'No preview available');
          return;
        }
        setTextPreview(res.content);
      } catch (e) {
        setTextPreviewError(e instanceof Error ? e.message : String(e));
      } finally {
        setTextPreviewLoading(false);
      }
    },
    [requestImagePreview, requestTextPreview],
  );

  useEffect(() => {
    if (!selected || selected.isDirectory) {
      // Reset previews when deselected or directory selected
      setImagePreviewUri(null);
      setImagePreviewError(null);
      setImagePreviewLoading(false);
      setTextPreview(null);
      setTextPreviewError(null);
      setTextPreviewLoading(false);
      return;
    }
    loadPreview(selected);
  }, [selected, loadPreview]);

  return (
    <View style={styles.detailPane}>
      <Text style={styles.detailTitle}>Details</Text>
      {!selected ? (
        <Text style={styles.detailEmpty}>Select a file or directory.</Text>
      ) : (
        <View style={styles.detailCard}>
          <Text style={styles.detailName} numberOfLines={2}>
            {selected.name}
          </Text>
          <PathDisplay path={selected.path} />
          <View style={styles.detailGrid}>
            <DetailLine
              label="Type"
              value={selected.isDirectory ? 'Directory' : 'File'}
            />
            <DetailLine
              label="Size"
              value={selected.isDirectory ? '—' : formatBytes(selected.size)}
            />
            <DetailLine
              label="Modified"
              value={formatDate(selected.modifiedAtMs)}
            />
          </View>

          {!selected.isDirectory && isLikelyImageFile(selected.path) ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>Image preview</Text>
              {imagePreviewLoading ? (
                <View style={styles.previewLoading}>
                  <ActivityIndicator />
                  <Text style={styles.previewLoadingText}>
                    Loading preview…
                  </Text>
                </View>
              ) : imagePreviewError ? (
                <Text style={styles.previewError}>{imagePreviewError}</Text>
              ) : imagePreviewUri ? (
                <Image
                  source={{ uri: imagePreviewUri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.previewHint}>
                  Tap the file again to re-fetch preview (limited size).
                </Text>
              )}
            </View>
          ) : null}

          {!selected.isDirectory && !isLikelyImageFile(selected.path) ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>File preview</Text>
              {textPreviewLoading ? (
                <View style={styles.previewLoading}>
                  <ActivityIndicator />
                  <Text style={styles.previewLoadingText}>
                    Loading preview…
                  </Text>
                </View>
              ) : textPreviewError ? (
                <Text style={styles.previewError}>{textPreviewError}</Text>
              ) : textPreview ? (
                <ScrollView style={styles.textPreviewScroll}>
                  <Text style={styles.textPreviewContent}>
                    {formatTextPreview(textPreview)}
                  </Text>
                </ScrollView>
              ) : (
                <Text style={styles.previewHint}>
                  Tap the file again to re-fetch preview (limited size).
                </Text>
              )}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  detailPane: {
    flex: 1,
    padding: 16,
  },
  detailTitle: {
    color: '#f2f2f2',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  detailEmpty: {
    color: '#9a9aa7',
    fontSize: 12,
  },
  detailCard: {
    borderWidth: 1,
    borderColor: '#1c1c24',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#0f1016',
    gap: 10,
  },
  detailName: {
    color: '#f2f2f2',
    fontSize: 13,
    fontWeight: '700',
  },
  detailGrid: {
    gap: 8,
  },
  previewBox: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#1c1c24',
    paddingTop: 10,
    gap: 8,
  },
  previewTitle: {
    color: '#eaeaf2',
    fontSize: 12,
    fontWeight: '700',
  },
  previewHint: {
    color: '#9a9aa7',
    fontSize: 12,
  },
  previewError: {
    color: '#ffb3c1',
    fontSize: 12,
  },
  previewLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewLoadingText: {
    color: '#cfcfe0',
    fontSize: 12,
  },
  previewImage: {
    width: '100%',
    height: 240,
    backgroundColor: '#0b0b0f',
    borderRadius: 10,
  },
  textPreviewScroll: {
    maxHeight: 300,
    backgroundColor: '#0b0b0f',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1c1c24',
  },
  textPreviewContent: {
    color: '#d6d6d6',
    fontSize: 11,
    fontFamily: 'Menlo',
    lineHeight: 16,
  },
});
