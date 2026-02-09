import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  type PressableStateCallbackType,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// Extended pressable state for react-native-web (includes hover)
type WebPressableState = PressableStateCallbackType & { hovered?: boolean };
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type {
  FileSystemEventMap,
  FileSystemProvider,
  FsEntry,
  FsRoots,
} from './shared/protocol';
import { PLUGIN_ID } from './shared/protocol';
import { isLikelyImageFile, isLikelyTextFile, parentPath } from './shared/path';

function newRequestId(): string {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function formatBytes(bytes?: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

function formatDate(ms?: number | null): string {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '—';
  }
}

type PendingResolvers = {
  roots: Map<
    string,
    (payload: FileSystemEventMap['fs:get-roots:result']) => void
  >;
  list: Map<string, (payload: FileSystemEventMap['fs:list:result']) => void>;
  image: Map<
    string,
    (payload: FileSystemEventMap['fs:read-image:result']) => void
  >;
  file: Map<
    string,
    (payload: FileSystemEventMap['fs:read-file:result']) => void
  >;
};

export default function FileSystemPanel() {
  const client = useRozeniteDevToolsClient<FileSystemEventMap>({
    pluginId: PLUGIN_ID,
  });

  const pendingRef = useRef<PendingResolvers>({
    roots: new Map(),
    list: new Map(),
    image: new Map(),
    file: new Map(),
  });

  const [provider, setProvider] = useState<FileSystemProvider>('none');
  const [roots, setRoots] = useState<FsRoots['roots']>([]);
  const [pathInput, setPathInput] = useState('');
  const [currentPath, setCurrentPath] = useState('');

  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<FsEntry | null>(null);
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);
  const [imagePreviewError, setImagePreviewError] = useState<string | null>(
    null,
  );
  const [imagePreviewLoading, setImagePreviewLoading] = useState(false);

  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [textPreviewError, setTextPreviewError] = useState<string | null>(null);
  const [textPreviewLoading, setTextPreviewLoading] = useState(false);

  useEffect(() => {
    if (!client) return;

    const subRoots = client.onMessage('fs:get-roots:result', (payload) => {
      const resolve = pendingRef.current.roots.get(payload.requestId);
      if (resolve) {
        pendingRef.current.roots.delete(payload.requestId);
        resolve(payload);
      }
    });

    const subList = client.onMessage('fs:list:result', (payload) => {
      const resolve = pendingRef.current.list.get(payload.requestId);
      if (resolve) {
        pendingRef.current.list.delete(payload.requestId);
        resolve(payload);
      }
    });

    const subImage = client.onMessage('fs:read-image:result', (payload) => {
      const resolve = pendingRef.current.image.get(payload.requestId);
      if (resolve) {
        pendingRef.current.image.delete(payload.requestId);
        resolve(payload);
      }
    });

    const subFile = client.onMessage('fs:read-file:result', (payload) => {
      const resolve = pendingRef.current.file.get(payload.requestId);
      if (resolve) {
        pendingRef.current.file.delete(payload.requestId);
        resolve(payload);
      }
    });

    return () => {
      subRoots.remove();
      subList.remove();
      subImage.remove();
      subFile.remove();
    };
  }, [client]);

  const requestRoots = useCallback(async () => {
    if (!client) return null;
    const requestId = newRequestId();
    const p = new Promise<FileSystemEventMap['fs:get-roots:result']>(
      (resolve) => {
        pendingRef.current.roots.set(requestId, resolve);
      },
    );
    client.send('fs:get-roots', { requestId });
    return await withTimeout(p, 8000, 'Timeout fetching roots');
  }, [client]);

  const requestList = useCallback(
    async (path: string) => {
      if (!client) return null;
      const requestId = newRequestId();
      const p = new Promise<FileSystemEventMap['fs:list:result']>((resolve) => {
        pendingRef.current.list.set(requestId, resolve);
      });
      client.send('fs:list', { requestId, path });
      return await withTimeout(p, 15000, 'Timeout listing directory');
    },
    [client],
  );

  const requestImagePreview = useCallback(
    async (path: string, maxBytes = 10_000_000) => {
      if (!client) return null;
      const requestId = newRequestId();
      const p = new Promise<FileSystemEventMap['fs:read-image:result']>(
        (resolve) => {
          pendingRef.current.image.set(requestId, resolve);
        },
      );
      client.send('fs:read-image', { requestId, path, maxBytes });
      return await withTimeout(p, 15000, 'Timeout reading image');
    },
    [client],
  );

  const requestTextPreview = useCallback(
    async (path: string, maxBytes = 10_000_000) => {
      if (!client) return null;
      const requestId = newRequestId();
      const p = new Promise<FileSystemEventMap['fs:read-file:result']>(
        (resolve) => {
          pendingRef.current.file.set(requestId, resolve);
        },
      );
      client.send('fs:read-file', { requestId, path, maxBytes });
      return await withTimeout(p, 15000, 'Timeout reading file');
    },
    [client],
  );

  const loadRootsAndMaybeInit = useCallback(async () => {
    setError(null);
    const res = await requestRoots();
    if (!res) return;
    setProvider(res.provider);
    if (res.error) {
      setRoots([]);
      setError(res.error);
      return;
    }
    setRoots(res.roots);

    // Initialize path to first root only once
    if (!currentPath && res.roots.length > 0) {
      const first = res.roots[0]!.path;
      setPathInput(first);
      setCurrentPath(first);
    }
  }, [currentPath, requestRoots]);

  useEffect(() => {
    if (!client) return;
    loadRootsAndMaybeInit();
  }, [client, loadRootsAndMaybeInit]);

  const loadDir = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      setSelected(null);
      setImagePreviewUri(null);
      setImagePreviewError(null);
      setImagePreviewLoading(false);
      setTextPreview(null);
      setTextPreviewError(null);
      setTextPreviewLoading(false);

      try {
        const res = await requestList(path);
        if (!res) return;
        setProvider(res.provider);
        setCurrentPath(res.path);
        setPathInput(res.path);
        if (res.error) {
          setEntries([]);
          setError(res.error);
          return;
        }
        setEntries(res.entries);
      } catch (e) {
        setEntries([]);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [requestList],
  );

  useEffect(() => {
    if (!client) return;
    if (!currentPath) return;
    loadDir(currentPath);
  }, [client, currentPath]);

  // Handle RN app ready/reconnect - re-fetch data when RN side (re)initializes
  useEffect(() => {
    if (!client) return;

    const subReady = client.onMessage('fs:ready', async () => {
      // Reset UI state on reconnect
      setProvider('none');
      setRoots([]);
      setEntries([]);
      setSelected(null);
      setImagePreviewUri(null);
      setTextPreview(null);
      setError(null);

      // Re-fetch roots
      await loadRootsAndMaybeInit();

      // If user was in a directory, reload it
      if (currentPath) {
        loadDir(currentPath);
      }
    });

    return () => {
      subReady.remove();
    };
  }, [client, currentPath, loadDir, loadRootsAndMaybeInit]);

  const onGo = useCallback(() => {
    const next = pathInput.trim();
    if (!next) return;
    setCurrentPath(next);
  }, [pathInput]);

  // Check if we can go back (not at or above a root path)
  const canGoBack = useMemo(() => {
    if (!currentPath) return false;
    // If current path is one of the roots, we can't go up
    const isAtRoot = roots.some((r) => r.path === currentPath);
    if (isAtRoot) return false;
    // Check if parent path exists and we wouldn't go above a root
    const parent = parentPath(currentPath);
    if (!parent) return false;
    // Ensure we're still within one of the root paths
    return roots.some((r) => parent.startsWith(r.path) || parent === r.path);
  }, [currentPath, roots]);

  const onBack = useCallback(() => {
    if (!canGoBack) return;
    const p = parentPath(currentPath);
    if (!p) return;
    setCurrentPath(p);
  }, [currentPath, canGoBack]);

  const onReload = useCallback(() => {
    if (!currentPath) return;
    loadDir(currentPath);
  }, [currentPath, loadDir]);

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
  }, [currentPath, roots]);

  const onSelectEntry = useCallback(
    async (entry: FsEntry) => {
      setSelected(entry);
      setImagePreviewUri(null);
      setImagePreviewError(null);
      setTextPreview(null);
      setTextPreviewError(null);

      if (entry.isDirectory) {
        setCurrentPath(entry.path);
        return;
      }

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

  const headerRight = useMemo(() => {
    const status =
      provider === 'none'
        ? 'No provider'
        : provider === 'expo'
          ? 'Expo FileSystem'
          : 'react-native-fs';
    return <Text style={styles.statusText}>{status}</Text>;
  }, [provider]);

  if (!client) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.centerText}>Connecting to React Native…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.title}>File System</Text>
          {headerRight}
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

      <View style={styles.body}>
        <View style={styles.listPane}>
          <View style={styles.listHeader}>
            {currentPath ? (
              <PathDisplay path={currentPath} />
            ) : (
              <Text style={styles.listHeaderTitle}>—</Text>
            )}
            {loading ? <ActivityIndicator size="small" /> : null}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Error</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <FlatList
            data={entries}
            keyExtractor={(item) => item.path}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected = selected?.path === item.path;
              return (
                <Pressable
                  onPress={() => onSelectEntry(item)}
                  style={(state: WebPressableState) => [
                    styles.row,
                    state.hovered && !isSelected && styles.rowHovered,
                    isSelected ? styles.rowSelected : undefined,
                  ]}
                >
                  <Text style={styles.rowIcon}>
                    {item.isDirectory
                      ? '📁'
                      : isLikelyImageFile(item.path)
                        ? '🖼️'
                        : isLikelyTextFile(item.path)
                          ? '📝'
                          : '📄'}
                  </Text>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {item.isDirectory
                        ? 'Directory'
                        : `${formatBytes(item.size)} • ${formatDate(
                            item.modifiedAtMs,
                          )}`}
                    </Text>
                  </View>
                  <Text style={styles.rowChevron}>
                    {item.isDirectory ? '›' : ''}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

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
                  value={
                    selected.isDirectory ? '—' : formatBytes(selected.size)
                  }
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
      </View>
    </SafeAreaView>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

type CopyState = 'idle' | 'copied' | 'error';

// Helper to copy text to clipboard (works in web views)
function copyToClipboard(text: string): boolean {
  try {
    // Use the textarea fallback approach which is most reliable
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch {
    return false;
  }
}

function PathDisplay({ path, label }: { path: string; label?: string }) {
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const handleCopy = useCallback(() => {
    const success = copyToClipboard(path);
    if (success) {
      setCopyState('copied');
    } else {
      setCopyState('error');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  }, [path]);

  const copyIcon =
    copyState === 'copied' ? '✓' : copyState === 'error' ? '✕' : '⧉';
  const copyLabel =
    copyState === 'copied'
      ? 'Copied!'
      : copyState === 'error'
        ? 'Failed'
        : 'Copy';

  return (
    <View style={styles.pathDisplayContainer}>
      {label ? <Text style={styles.pathDisplayLabel}>{label}</Text> : null}
      <View style={styles.pathDisplayRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pathDisplayScroll}
          contentContainerStyle={styles.pathDisplayScrollContent}
        >
          <Text style={styles.pathDisplayText} selectable>
            {path}
          </Text>
        </ScrollView>
        <View style={styles.pathDisplayActions}>
          <Pressable
            style={(state: WebPressableState) => [
              styles.pathActionButton,
              state.hovered && styles.pathActionButtonHovered,
              copyState === 'copied' && styles.pathActionButtonSuccess,
              copyState === 'error' && styles.pathActionButtonError,
            ]}
            onPress={handleCopy}
          >
            <Text
              style={[
                styles.pathActionIcon,
                copyState === 'copied' && styles.pathActionIconSuccess,
                copyState === 'error' && styles.pathActionIconError,
              ]}
            >
              {copyIcon}
            </Text>
            <Text
              style={[
                styles.pathActionLabel,
                copyState === 'copied' && styles.pathActionLabelSuccess,
                copyState === 'error' && styles.pathActionLabelError,
              ]}
            >
              {copyLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// Content Formatters
// Add new formatters here to support pretty-printing additional formats.
// Each formatter returns { success: true, formatted: string } or { success: false }
// ============================================================================

type FormatResult = { success: true; formatted: string } | { success: false };

type ContentFormatter = (content: string) => FormatResult;

const formatters: ContentFormatter[] = [
  // JSON formatter
  (content: string): FormatResult => {
    try {
      const parsed = JSON.parse(content);
      return { success: true, formatted: JSON.stringify(parsed, null, 2) };
    } catch {
      return { success: false };
    }
  },

  // PLIST / XML formatter
  (content: string): FormatResult => {
    // Remove BOM if present and trim
    const cleaned = content.replace(/^\uFEFF/, '').trim();

    // Check if it looks like XML/PLIST (handle various XML starts)
    const looksLikeXml =
      cleaned.startsWith('<?xml') ||
      cleaned.startsWith('<!DOCTYPE') ||
      cleaned.startsWith('<plist') ||
      cleaned.startsWith('<dict') ||
      cleaned.startsWith('<array') ||
      (cleaned.startsWith('<') && cleaned.includes('</'));

    if (!looksLikeXml) {
      return { success: false };
    }

    try {
      return { success: true, formatted: formatXml(cleaned) };
    } catch {
      return { success: false };
    }
  },

  // Add more formatters here in the future:
  // - YAML formatter
  // - INI formatter
  // - etc.
];

function formatXml(xml: string): string {
  let formatted = '';
  let indent = 0;
  const tab = '  ';

  // Normalize: collapse all whitespace between tags, then split by tags
  const normalized = xml
    .replace(/>\s+</g, '><') // Remove whitespace between tags
    .replace(/</g, '\n<') // Add newline before each opening tag
    .replace(/>/g, '>\n') // Add newline after each closing tag
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const token of normalized) {
    // Handle closing tags - decrease indent first
    if (token.startsWith('</')) {
      indent = Math.max(0, indent - 1);
      formatted += tab.repeat(indent) + token + '\n';
      continue;
    }

    // Handle self-closing tags and processing instructions
    if (
      token.endsWith('/>') ||
      token.startsWith('<?') ||
      token.startsWith('<!')
    ) {
      formatted += tab.repeat(indent) + token + '\n';
      continue;
    }

    // Handle opening tags with inline content like <string>value</string>
    if (token.startsWith('<') && token.includes('</')) {
      formatted += tab.repeat(indent) + token + '\n';
      continue;
    }

    // Handle opening tags - add then increase indent
    if (token.startsWith('<')) {
      formatted += tab.repeat(indent) + token + '\n';
      indent++;
      continue;
    }

    // Text content
    formatted += tab.repeat(indent) + token + '\n';
  }

  return formatted.trim();
}

function formatTextPreview(content: string): string {
  // Try each formatter in order, return first successful result
  for (const formatter of formatters) {
    const result = formatter(content);
    if (result.success) {
      return result.formatted;
    }
  }
  // No formatter matched, return raw content
  return content;
}

async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  centerText: {
    color: '#d6d6d6',
    fontSize: 14,
  },

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

  button: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1b1c25',
    borderWidth: 1,
    borderColor: '#2a2b37',
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
  buttonText: {
    color: '#e9e9ee',
    fontSize: 12,
    fontWeight: '600',
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

  body: {
    flex: 1,
    flexDirection: 'row',
  },
  listPane: {
    flex: 1.2,
    borderRightWidth: 1,
    borderRightColor: '#1c1c24',
  },
  detailPane: {
    flex: 1,
    padding: 16,
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
  detailPath: {
    color: '#9a9aa7',
    fontSize: 11,
    fontFamily: 'Menlo',
  },
  detailGrid: {
    gap: 8,
  },
  detailLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailLabel: {
    color: '#9a9aa7',
    fontSize: 11,
  },
  detailValue: {
    color: '#eaeaf2',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: '70%',
    textAlign: 'right',
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

  // PathDisplay styles
  pathDisplayContainer: {
    flex: 1,
    gap: 6,
  },
  pathDisplayLabel: {
    color: '#9a9aa7',
    fontSize: 11,
    fontWeight: '600',
  },
  pathDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0b0b0f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1c1c24',
    paddingLeft: 10,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  pathDisplayScroll: {
    flex: 1,
    maxHeight: 32,
  },
  pathDisplayScrollContent: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  pathDisplayText: {
    color: '#b8b8c8',
    fontSize: 11,
    fontFamily: 'Menlo',
  },
  pathDisplayActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pathActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#2a2b37',
  },
  pathActionButtonHovered: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  pathActionButtonSuccess: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  pathActionButtonError: {
    backgroundColor: 'rgba(255, 99, 132, 0.1)',
  },
  pathActionIcon: {
    color: '#9a9aa7',
    fontSize: 12,
  },
  pathActionIconSuccess: {
    color: '#4ade80',
  },
  pathActionIconError: {
    color: '#ff6384',
  },
  pathActionLabel: {
    color: '#9a9aa7',
    fontSize: 10,
    fontWeight: '600',
  },
  pathActionLabelSuccess: {
    color: '#4ade80',
  },
  pathActionLabelError: {
    color: '#ff6384',
  },
});
