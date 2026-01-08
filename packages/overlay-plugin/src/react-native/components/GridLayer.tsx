import React, { memo, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect, Path } from 'react-native-svg';
import { GridConfig } from '../../shared/types';

export const GridLayer: React.FC<{ config: GridConfig }> = memo(({ config }) => {
  if (!config.enabled) {
    return null;
  }

  const { size, color, opacity, majorEvery, minorLineWidth, majorLineWidth } = config;

  const patternSize = majorEvery > 0 ? size * majorEvery : size;
  const boundaryWeight = majorEvery > 0 ? majorLineWidth : minorLineWidth;
  const innerWeight = minorLineWidth;

  const innerPath = useMemo(() => {
    if (majorEvery <= 1) return null;

    let d = '';
    // Generate inner lines
    for (let i = 1; i < majorEvery; i++) {
      const offset = i * size;
      // Vertical line
      d += `M ${offset} 0 V ${patternSize} `;
      // Horizontal line
      d += `M 0 ${offset} H ${patternSize} `;
    }
    return d;
  }, [majorEvery, size, patternSize]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id="grid-pattern"
            patternUnits="userSpaceOnUse"
            width={patternSize}
            height={patternSize}
            x="0"
            y="0"
          >
            {/* Boundary Rect (Major lines or Base lines) */}
            <Rect
              x={0}
              y={0}
              width={patternSize}
              height={patternSize}
              fill="none"
              stroke={color}
              strokeWidth={boundaryWeight}
            />
            {/* Inner Lines (Minor lines) */}
            {innerPath && (
              <Path
                d={innerPath}
                fill="none"
                stroke={color}
                strokeWidth={innerWeight}
              />
            )}
          </Pattern>
        </Defs>
        {/* Main Rect filling the screen with the pattern */}
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#grid-pattern)"
          opacity={opacity}
        />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  gridLine: {
    position: 'absolute',
  },
});
