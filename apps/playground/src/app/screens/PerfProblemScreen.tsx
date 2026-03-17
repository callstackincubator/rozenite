import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ITEM_COUNT = 16;
const BLOCK_TIME_MS = 200;

const burnCpu = (durationMs: number) => {
  const start = Date.now();
  let value = 0;

  while (Date.now() - start < durationMs) {
    value += Math.sqrt(value + 1);
  }

  return value;
};

type PerfItemProps = {
  index: number;
};

const PerfItem = ({ index }: PerfItemProps) => {
  const startedAt = Date.now();
  burnCpu(BLOCK_TIME_MS);
  const renderDuration = Date.now() - startedAt;

  return (
    <View style={styles.item}>
      <Text style={styles.itemTitle}>Heavy Item {index + 1}</Text>
      <Text style={styles.itemSubtitle}>
        Render blocked JS thread for {renderDuration}ms
      </Text>
    </View>
  );
};

export const PerfProblemScreen = () => {
  const items = Array.from({ length: ITEM_COUNT }, (_, index) => index);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>PerfProblemScreen</Text>
      <Text style={styles.subtitle}>
        This screen intentionally renders 16 items that each block for over
        50ms.
      </Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <PerfItem index={item} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
    paddingTop: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    paddingHorizontal: 20,
  },
  subtitle: {
    color: '#bbbbbb',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  item: {
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#2d2d2d',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  itemSubtitle: {
    color: '#9f9f9f',
    fontSize: 13,
    marginTop: 4,
  },
});
