import { useEffect, useState } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { Card, CardContent } from '@heroui/react';
import { OverlayPluginEventMap, GridConfig, ImageConfig } from '../shared';
import { Header, GridSettings, ImageSettings } from './components';
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
    // Request initial state
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
    setGridConfig(newConfig); // Optimistic update
    if (client) {
      client.send('set-grid-config', { config: newConfig });
    }
  };

  const updateImageConfig = (newConfig: ImageConfig) => {
    setImageConfig(newConfig); // Optimistic update
    if (client) {
      client.send('set-image-config', { config: newConfig });
    }
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-4 text-white">
        <Header />
        <Card className="mx-auto mt-6 max-w-2xl border border-white/10 bg-white/5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <CardContent className="items-center justify-center py-16 text-sm text-white/70">
            Loading overlay state...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 text-white">
      <Header />
      <div className="mx-auto mt-6 grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <GridSettings config={gridConfig} onConfigChange={updateGridConfig} />
        <ImageSettings config={imageConfig} onConfigChange={updateImageConfig} />
      </div>
    </div>
  );
}
