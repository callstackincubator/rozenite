import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  PanResponder,
  Dimensions,
  ViewStyle,
} from 'react-native';
import {
  useRozeniteDevToolsClient,
  createRozeniteRPCBridge,
} from '@rozenite/plugin-bridge';
import { OverlayAppProtocol, OverlayDevToolsProtocol } from '../shared';
import { GridConfig, ImageConfig } from '../shared/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GridLayer: React.FC<{ config: GridConfig }> = ({ config }) => {
  if (!config.enabled) {
    return null;
  }

  const { size, color, opacity } = config;
  const rows = Math.ceil(SCREEN_HEIGHT / size);
  const cols = Math.ceil(SCREEN_WIDTH / size);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: rows + 1 }).map((_, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={[
            styles.gridLine,
            {
              top: rowIndex * size,
              width: SCREEN_WIDTH,
              height: 1,
              backgroundColor: color,
              opacity,
            },
          ]}
        />
      ))}
      {Array.from({ length: cols + 1 }).map((_, colIndex) => (
        <View
          key={`col-${colIndex}`}
          style={[
            styles.gridLine,
            {
              left: colIndex * size,
              width: 1,
              height: SCREEN_HEIGHT,
              backgroundColor: color,
              opacity,
            },
          ]}
        />
      ))}
    </View>
  );
};

const ImageComparisonLayer: React.FC<{ config: ImageConfig }> = ({ config }) => {
  const [splitPosition, setSplitPosition] = useState(SCREEN_WIDTH / 2);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Optional: Add haptic feedback
      },
      onPanResponderMove: (evt) => {
        const newPosition = Math.max(
          0,
          Math.min(SCREEN_WIDTH, evt.nativeEvent.pageX)
        );
        setSplitPosition(newPosition);
      },
      onPanResponderRelease: () => {
        // Optional: Add haptic feedback
      },
    })
  ).current;

  if (!config.enabled || !config.uri) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Left side - overlay image */}
      <View
        style={[
          styles.imageContainer,
          {
            width: splitPosition,
            opacity: config.opacity,
          },
        ]}
      >
        <Image
          source={{ uri: config.uri }}
          style={styles.overlayImage}
          resizeMode="contain"
        />
      </View>

      {/* Right side - app content (transparent, allows app to show through) */}
      <View style={[styles.imageContainer, { left: splitPosition }]} />

      {/* Draggable handle */}
      <View
        style={[
          styles.dragHandle,
          {
            left: splitPosition - 10,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.dragHandleBar} />
      </View>
    </View>
  );
};

export const RozeniteOverlay: React.FC = () => {
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    enabled: false,
    size: 8,
    color: '#FF0000',
    opacity: 0.5,
  });
  const [imageConfig, setImageConfig] = useState<ImageConfig>({
    enabled: false,
    opacity: 0.5,
    uri: null,
  });

  const client = useRozeniteDevToolsClient({
    pluginId: '@rozenite/overlay-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    // Create RPC bridge with App protocol handlers
    const localHandlers: OverlayAppProtocol = {
      async setGridConfig(config) {
        setGridConfig(config);
      },
      async setImageConfig(config) {
        setImageConfig(config);
      },
      async getOverlayState() {
        return {
          grid: gridConfig,
          image: imageConfig,
        };
      },
    };

    const devTools = createRozeniteRPCBridge<
      OverlayAppProtocol,
      OverlayDevToolsProtocol
    >(
      {
        send: (msg) => client.send('rpc', msg),
        onMessage: (listener) => client.onMessage('rpc', listener),
      },
      localHandlers
    );
  }, [client, gridConfig, imageConfig]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <GridLayer config={gridConfig} />
      <ImageComparisonLayer config={imageConfig} />
    </View>
  );
};

const styles = StyleSheet.create({
  gridLine: {
    position: 'absolute',
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  overlayImage: {
    width: '100%',
    height: '100%',
  },
  dragHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dragHandleBar: {
    width: 4,
    height: '100%',
    backgroundColor: '#8232FF',
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
});

