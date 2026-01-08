import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { OverlayPluginEventMap } from '../shared';
import { GridConfig, ImageConfig } from '../shared/types';
import { GridLayer } from './components/GridLayer';
import { ImageComparisonLayer } from './components/ImageComparisonLayer';

export const RozeniteOverlay: React.FC = () => {
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    enabled: false,
    size: 8,
    color: '#FF0000',
    opacity: 0.7,
  });
  const [imageConfig, setImageConfig] = useState<ImageConfig>({
    enabled: false,
    opacity: 0.7,
    uri: null,
    mode: 'overlay',
    resizeMode: 'contain',
  });

  const client = useRozeniteDevToolsClient<OverlayPluginEventMap>({
    pluginId: '@rozenite/overlay-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscriptions = [
      client.onMessage('set-grid-config', ({ config }) => {
        setGridConfig(config);
      }),
      client.onMessage('set-image-config', ({ config }) => {
        setImageConfig(config);
      }),
      client.onMessage('request-overlay-state', () => {
        client.send('overlay-state', {
          grid: gridConfig,
          image: imageConfig,
        });
      }),
    ];

    return () => {
      subscriptions.forEach((sub) => sub.remove());
    };
  }, [client, gridConfig, imageConfig]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <GridLayer config={gridConfig} />
      <ImageComparisonLayer config={imageConfig} />
    </View>
  );
};
