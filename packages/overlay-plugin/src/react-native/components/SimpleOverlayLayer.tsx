import React, { memo } from 'react';
import { View, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { ImageConfig } from '../../shared/types';

export const SimpleOverlayLayer: React.FC<{ config: ImageConfig }> = memo(({
  config,
}) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  if (!config.uri) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: config.uri }}
        style={[
          styles.overlayImage,
          {
            opacity: config.opacity,
            width: SCREEN_WIDTH,
          },
        ]}
        resizeMode={config.resizeMode || 'contain'}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  overlayImage: {
    width: '100%',
    height: '100%',
  },
});
