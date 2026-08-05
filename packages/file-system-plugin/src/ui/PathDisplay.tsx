import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { WebPressableState } from '../types';
import { copyToClipboard } from '../utils';

type CopyState = 'idle' | 'copied' | 'error';

type PathDisplayProps = {
  path: string;
  label?: string;
};

export function PathDisplay({ path, label }: PathDisplayProps) {
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

const styles = StyleSheet.create({
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
