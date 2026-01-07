import { useEffect, useState, useRef } from 'react';
import {
  useRozeniteDevToolsClient,
  createRozeniteRPCBridge,
} from '@rozenite/plugin-bridge';
import { OverlayAppProtocol, OverlayDevToolsProtocol } from '../shared';
import { GridConfig, ImageConfig } from '../shared/types';
import { Grid, Image as ImageIcon, Upload, X } from 'lucide-react';
import './globals.css';

export default function OverlayPanel() {
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
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const client = useRozeniteDevToolsClient({
    pluginId: '@rozenite/overlay-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    // Create RPC bridge to call App methods
    const localHandlers: OverlayDevToolsProtocol = {
      // Currently empty, but can be extended in the future
    };

    const app = createRozeniteRPCBridge<OverlayDevToolsProtocol, OverlayAppProtocol>(
      {
        send: (msg) => client.send('rpc', msg),
        onMessage: (listener) => client.onMessage('rpc', listener),
      },
      localHandlers
    );

    // Load initial state
    setLoading(true);
    app
      .getOverlayState()
      .then((state) => {
        setGridConfig(state.grid);
        setImageConfig(state.image);
      })
      .catch((err) => {
        console.error('[Rozenite] Overlay Plugin: Error loading state', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [client]);

  const handleGridToggle = (enabled: boolean) => {
    const newConfig = { ...gridConfig, enabled };
    setGridConfig(newConfig);
    if (client) {
      const app = createRozeniteRPCBridge<OverlayDevToolsProtocol, OverlayAppProtocol>(
        {
          send: (msg) => client.send('rpc', msg),
          onMessage: (listener) => client.onMessage('rpc', listener),
        },
        {}
      );
      app.setGridConfig(newConfig).catch((err) => {
        console.error('[Rozenite] Overlay Plugin: Error setting grid config', err);
      });
    }
  };

  const handleGridSizeChange = (size: number) => {
    const newConfig = { ...gridConfig, size };
    setGridConfig(newConfig);
    if (client) {
      const app = createRozeniteRPCBridge<OverlayDevToolsProtocol, OverlayAppProtocol>(
        {
          send: (msg) => client.send('rpc', msg),
          onMessage: (listener) => client.onMessage('rpc', listener),
        },
        {}
      );
      app.setGridConfig(newConfig).catch((err) => {
        console.error('[Rozenite] Overlay Plugin: Error setting grid config', err);
      });
    }
  };

  const handleGridColorChange = (color: string) => {
    const newConfig = { ...gridConfig, color };
    setGridConfig(newConfig);
    if (client) {
      const app = createRozeniteRPCBridge<OverlayDevToolsProtocol, OverlayAppProtocol>(
        {
          send: (msg) => client.send('rpc', msg),
          onMessage: (listener) => client.onMessage('rpc', listener),
        },
        {}
      );
      app.setGridConfig(newConfig).catch((err) => {
        console.error('[Rozenite] Overlay Plugin: Error setting grid config', err);
      });
    }
  };

  const handleGridOpacityChange = (opacity: number) => {
    const newConfig = { ...gridConfig, opacity };
    setGridConfig(newConfig);
    if (client) {
      const app = createRozeniteRPCBridge<OverlayDevToolsProtocol, OverlayAppProtocol>(
        {
          send: (msg) => client.send('rpc', msg),
          onMessage: (listener) => client.onMessage('rpc', listener),
        },
        {}
      );
      app.setGridConfig(newConfig).catch((err) => {
        console.error('[Rozenite] Overlay Plugin: Error setting grid config', err);
      });
    }
  };

  const handleImageToggle = (enabled: boolean) => {
    const newConfig = { ...imageConfig, enabled };
    setImageConfig(newConfig);
    if (client) {
      const app = createRozeniteRPCBridge<OverlayDevToolsProtocol, OverlayAppProtocol>(
        {
          send: (msg) => client.send('rpc', msg),
          onMessage: (listener) => client.onMessage('rpc', listener),
        },
        {}
      );
      app.setImageConfig(newConfig).catch((err) => {
        console.error('[Rozenite] Overlay Plugin: Error setting image config', err);
      });
    }
  };

  const handleImageOpacityChange = (opacity: number) => {
    const newConfig = { ...imageConfig, opacity };
    setImageConfig(newConfig);
    if (client) {
      const app = createRozeniteRPCBridge<OverlayDevToolsProtocol, OverlayAppProtocol>(
        {
          send: (msg) => client.send('rpc', msg),
          onMessage: (listener) => client.onMessage('rpc', listener),
        },
        {}
      );
      app.setImageConfig(newConfig).catch((err) => {
        console.error('[Rozenite] Overlay Plugin: Error setting image config', err);
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Check file size (limit to 2MB to avoid issues with Base64 encoding)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      alert(
        `Image size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed size of 2MB. Please use a smaller image.`
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const newConfig = { ...imageConfig, uri: base64, enabled: true };
      setImageConfig(newConfig);
      if (client) {
        const app = createRozeniteRPCBridge<OverlayDevToolsProtocol, OverlayAppProtocol>(
          {
            send: (msg) => client.send('rpc', msg),
            onMessage: (listener) => client.onMessage('rpc', listener),
          },
          {}
        );
        app.setImageConfig(newConfig).catch((err) => {
          console.error('[Rozenite] Overlay Plugin: Error setting image config', err);
        });
      }
    };
    reader.onerror = () => {
      alert('Error reading image file');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    const newConfig = { ...imageConfig, uri: null, enabled: false };
    setImageConfig(newConfig);
    if (client) {
      const app = createRozeniteRPCBridge<OverlayDevToolsProtocol, OverlayAppProtocol>(
        {
          send: (msg) => client.send('rpc', msg),
          onMessage: (listener) => client.onMessage('rpc', listener),
        },
        {}
      );
      app.setImageConfig(newConfig).catch((err) => {
        console.error('[Rozenite] Overlay Plugin: Error setting image config', err);
      });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Grid Overlay Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Grid className="w-5 h-5 text-foreground" />
          <h2 className="text-xl font-semibold">Grid Overlay</h2>
        </div>

        <div className="space-y-4 pl-7">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Enable Grid</label>
            <button
              onClick={() => handleGridToggle(!gridConfig.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                gridConfig.enabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  gridConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {gridConfig.enabled && (
            <>
              {/* Grid Size */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Cell Size: {gridConfig.size}px
                </label>
                <input
                  type="range"
                  min="4"
                  max="50"
                  value={gridConfig.size}
                  onChange={(e) => handleGridSizeChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Grid Color */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={gridConfig.color}
                    onChange={(e) => handleGridColorChange(e.target.value)}
                    className="h-10 w-20 rounded border border-border"
                  />
                  <input
                    type="text"
                    value={gridConfig.color}
                    onChange={(e) => handleGridColorChange(e.target.value)}
                    className="flex-1 px-3 py-2 rounded border border-border bg-background text-foreground text-sm"
                    placeholder="#FF0000"
                  />
                </div>
              </div>

              {/* Grid Opacity */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Opacity: {Math.round(gridConfig.opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={gridConfig.opacity}
                  onChange={(e) => handleGridOpacityChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Image Overlay Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-foreground" />
          <h2 className="text-xl font-semibold">Image Overlay</h2>
        </div>

        <div className="space-y-4 pl-7">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Enable Image Overlay</label>
            <button
              onClick={() => handleImageToggle(!imageConfig.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                imageConfig.enabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  imageConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Upload Image</label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="flex items-center gap-2 px-4 py-2 rounded border border-border bg-background text-foreground cursor-pointer hover:bg-accent transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span className="text-sm">Choose Image</span>
              </label>
              {imageConfig.uri && (
                <button
                  onClick={handleRemoveImage}
                  className="flex items-center gap-2 px-4 py-2 rounded border border-destructive bg-background text-destructive cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span className="text-sm">Remove</span>
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Maximum file size: 2MB. Drag the overlay left/right on device to compare.
            </p>
          </div>

          {imageConfig.enabled && imageConfig.uri && (
            <>
              {/* Image Preview */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Preview</label>
                <div className="border border-border rounded overflow-hidden">
                  <img
                    src={imageConfig.uri}
                    alt="Overlay preview"
                    className="w-full h-auto max-h-48 object-contain"
                  />
                </div>
              </div>

              {/* Image Opacity */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Opacity: {Math.round(imageConfig.opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={imageConfig.opacity}
                  onChange={(e) => handleImageOpacityChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

