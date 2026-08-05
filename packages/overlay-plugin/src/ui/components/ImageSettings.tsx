import { useRef, useState, useEffect } from 'react';
import { ImageConfig, ImageResizeMode, MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_MB } from '../../shared';
import { Image as ImageIcon, Upload, X, Clipboard } from 'lucide-react';
import { useThrottledCallback } from '../hooks/useThrottledCallback';

export type ImageSettingsProps = {
  config: ImageConfig;
  onConfigChange: (config: ImageConfig) => void;
};

export const ImageSettings = ({ config, onConfigChange }: ImageSettingsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localOpacity, setLocalOpacity] = useState(config.opacity);
  const [isPasteSupported] = useState(() => navigator.clipboard && 'read' in navigator.clipboard);

  useEffect(() => {
    setLocalOpacity(config.opacity);
  }, [config.opacity]);

  const handleChange = (changes: Partial<ImageConfig>) => {
    onConfigChange({ ...config, ...changes });
  };

  const commitChange = useThrottledCallback((changes: Partial<ImageConfig>) => {
    handleChange(changes);
  }, 50);

  const handleOpacityChange = (value: number) => {
    setLocalOpacity(value);
    commitChange({ opacity: value });
  };

  const processFile = (file: File | Blob) => {
    // Check file size
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      alert(
        `Image size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed size of ${MAX_IMAGE_SIZE_MB}MB.`
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      handleChange({ uri: base64, enabled: true });
    };
    reader.onerror = () => {
      alert('Error reading image file');
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handlePaste = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        // Look for an image type
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          processFile(blob);
          return;
        }
      }
      alert('No image found in clipboard');
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
      alert('Failed to access clipboard. Please ensure you have granted permission.');
    }
  };

  const handleRemoveImage = () => {
    handleChange({ uri: null, enabled: false });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="settings-section">
      <div className="section-header">
        <div className="section-title">
          <ImageIcon size={18} />
          <span>Image verlay</span>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => handleChange({ enabled: e.target.checked })}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="section-content">
        <div className="control-group">
          <label className="control-label">Overlay Image</label>
          {!config.uri ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                className="file-upload-area"
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: 'pointer' }}
              >
                <Upload size={32} color="var(--color-text-muted)" />
                <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                  Click to upload reference image
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
                  Max size: {MAX_IMAGE_SIZE_MB}MB
                </span>
              </div>
              {isPasteSupported && (
                <button
                  className="btn"
                  onClick={handlePaste}
                  style={{ justifyContent: 'center', width: '100%' }}
                >
                  <Clipboard size={14} />
                  Paste from Clipboard
                </button>
              )}
            </div>
          ) : (
            <div className="control-group">
              <div className="control-row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-danger" onClick={handleRemoveImage}>
                  <X size={14} />
                  Remove
                </button>
              </div>
              <img src={config.uri} alt="Overlay preview" className="file-preview" />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {config.enabled && config.uri && (
          <>
            <div className="control-group">
              <label className="control-label">Mode</label>
              <div className="control-row">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text)', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="mode"
                    value="overlay"
                    checked={config.mode === 'overlay'}
                    onChange={() => handleChange({ mode: 'overlay' })}
                  />
                  Simple overlay
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text)', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="mode"
                    value="slider"
                    checked={config.mode === 'slider'}
                    onChange={() => handleChange({ mode: 'slider' })}
                  />
                  Slider comparison
                </label>
              </div>
            </div>

            <div className="control-group">
              <label className="control-label">Resize Mode</label>
              <select
                value={config.resizeMode}
                onChange={(e) => handleChange({ resizeMode: e.target.value as ImageResizeMode })}
                className="input-control"
                style={{ width: '100%' }}
              >
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
                <option value="stretch">Stretch</option>
                <option value="center">Center</option>
              </select>
            </div>

            <div className="control-group">
              <label className="control-label">
                Opacity ({Math.round(localOpacity * 100)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localOpacity}
                onChange={(e) => handleOpacityChange(Number(e.target.value))}
                className="input-range"
              />
              {config.mode === 'slider' && (
                <p
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    marginTop: '4px',
                  }}
                >
                  Drag the divider handle on your device to compare.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};