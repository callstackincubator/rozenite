import { useEffect, useState } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { PluginHeader, PluginTheme, Surface } from '@rozenite/ui';
import { OverlayPluginEventMap } from '../shared';
import { GridConfig, ImageConfig } from '../shared';
import { GridSettings, ImageSettings } from './components';
import './globals.css';

export default function OverlayPanel() {
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    enabled: false,
    size: 8,
    color: '#FF0000',
    opacity: 0.5,
    majorEvery: 0,
    minorLineWidth: 1,
    majorLineWidth: 2,
  });
  const [imageConfig, setImageConfig] = useState<ImageConfig>({
    enabled: false,
    opacity: 0.5,
    uri: null,
    mode: 'overlay',
    resizeMode: 'contain',
  });
  const [loading, setLoading] = useState(false);

  const client = useRozeniteDevToolsClient<OverlayPluginEventMap>({
    pluginId: '@rozenite/overlay-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    setLoading(true);
    client.send('request-overlay-state', {});

    const subscription = client.onMessage('overlay-state', (state) => {
      setGridConfig(state.grid);
      setImageConfig(state.image);
      setLoading(false);
    });

    return () => {
      subscription.remove();
    };
  }, [client]);

  const updateGridConfig = (newConfig: GridConfig) => {
    setGridConfig(newConfig);
    if (client) {
      client.send('set-grid-config', { config: newConfig });
    }
  };

  const updateImageConfig = (newConfig: ImageConfig) => {
    setImageConfig(newConfig);
    if (client) {
      client.send('set-image-config', { config: newConfig });
    }
  };

  return (
    <PluginTheme
      className="flex h-screen flex-col bg-background text-foreground"
      defaultTheme="dark"
    >
      <PluginHeader title="Overlay" />

      <main className="flex-1 overflow-auto p-4 pt-3">
        {loading ? (
          <Surface className="text-sm text-muted" variant="secondary">
            Loading overlay settings...
          </Surface>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <GridSettings
              config={gridConfig}
              onConfigChange={updateGridConfig}
            />
            <ImageSettings
              config={imageConfig}
              onConfigChange={updateImageConfig}
            />
          </div>
        )}
      </main>
    </PluginTheme>
  );
};
