import { useEffect, useState } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { OverlayPluginEventMap } from '../shared';
import { GridConfig, ImageConfig } from '../shared/types';
import { Header, GridSettings, ImageSettings } from './components';
import './styles.css';

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
      <div className="app-container">
        <Header />
        <div className="main-content" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header />
      <div className="main-content">
        <GridSettings config={gridConfig} onConfigChange={updateGridConfig} />
        <ImageSettings config={imageConfig} onConfigChange={updateImageConfig} />
      </div>
    </div>
  );
}

