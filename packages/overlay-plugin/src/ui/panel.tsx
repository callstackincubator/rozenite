import { useEffect, useState } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { PluginShell, Sidebar, Split } from '@rozenite/ui';
import { OverlayPluginEventMap } from '../shared';
import { GridConfig, ImageConfig } from '../shared/types';
import { GridSettings, ImageSettings } from './components';
import '@rozenite/ui/styles.css';
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
  const [activeView, setActiveView] = useState<'grid' | 'image'>('grid');

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
      <PluginShell className="h-screen dark">
        <PluginShell.Body className="items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading overlay…</div>
        </PluginShell.Body>
      </PluginShell>
    );
  }

  return (
    <PluginShell className="h-screen dark">
      <PluginShell.Body>
        <Split direction="horizontal" autoSaveId="overlay-settings">
          <Split.Pane defaultSize={18} minSize={14} maxSize={28}>
            <Sidebar className="w-full border-r-0">
              <Sidebar.Group>
                <Sidebar.Item
                  selected={activeView === 'grid'}
                  onClick={() => setActiveView('grid')}
                >
                  Grid overlay
                </Sidebar.Item>
                <Sidebar.Item
                  selected={activeView === 'image'}
                  onClick={() => setActiveView('image')}
                >
                  Image overlay
                </Sidebar.Item>
              </Sidebar.Group>
            </Sidebar>
          </Split.Pane>
          <Split.Handle />
          <Split.Pane>
            {activeView === 'grid' ? (
              <GridSettings config={gridConfig} onConfigChange={updateGridConfig} />
            ) : (
              <ImageSettings config={imageConfig} onConfigChange={updateImageConfig} />
            )}
          </Split.Pane>
        </Split>
      </PluginShell.Body>
    </PluginShell>
  );
}
