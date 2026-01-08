import React, { memo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { GridConfig } from '../../shared/types';

export const GridLayer: React.FC<{ config: GridConfig }> = memo(({ config }) => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

  if (!config.enabled) {
    return null;
  }

  const { size, color, opacity, majorEvery, minorLineWidth, majorLineWidth } = config;
  const rows = Math.ceil(SCREEN_HEIGHT / size);
  const cols = Math.ceil(SCREEN_WIDTH / size);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: rows + 1 }).map((_, rowIndex) => {
        const isMajor = majorEvery > 0 && rowIndex % majorEvery === 0;
        const weight = isMajor ? majorLineWidth : minorLineWidth;
        return (
          <View
            key={`row-${rowIndex}`}
            style={[
              styles.gridLine,
              {
                top: rowIndex * size,
                width: SCREEN_WIDTH,
                height: weight,
                backgroundColor: color,
                opacity,
              },
            ]}
          />
        );
      })}
      {Array.from({ length: cols + 1 }).map((_, colIndex) => {
        const isMajor = majorEvery > 0 && colIndex % majorEvery === 0;
        const weight = isMajor ? majorLineWidth : minorLineWidth;
        return (
          <View
            key={`col-${colIndex}`}
            style={[
              styles.gridLine,
              {
                left: colIndex * size,
                width: weight,
                height: SCREEN_HEIGHT,
                backgroundColor: color,
                opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  gridLine: {
    position: 'absolute',
  },
});
