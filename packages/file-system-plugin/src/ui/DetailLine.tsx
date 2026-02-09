import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type DetailLineProps = {
  label: string;
  value: string;
};

export function DetailLine({ label, value }: DetailLineProps) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
