import { useState, useEffect } from 'react';
import { GridConfig } from '../../shared/types';
import { Grid } from 'lucide-react';
import { useThrottledCallback } from '../hooks/useThrottledCallback';

export type GridSettingsProps = {
  config: GridConfig;
  onConfigChange: (config: GridConfig) => void;
};

export const GridSettings = ({ config, onConfigChange }: GridSettingsProps) => {
  const [localOpacity, setLocalOpacity] = useState(config.opacity);

  useEffect(() => {
    setLocalOpacity(config.opacity);
  }, [config.opacity]);

  const handleChange = (changes: Partial<GridConfig>) => {
    onConfigChange({ ...config, ...changes });
  };

  const commitChange = useThrottledCallback((changes: Partial<GridConfig>) => {
    handleChange(changes);
  }, 50);

  const handleOpacityChange = (value: number) => {
    setLocalOpacity(value);
    commitChange({ opacity: value });
  };

  return (
    <div className="settings-section">
      <div className="section-header">
        <div className="section-title">
          <Grid size={18} />
          <span>Grid overlay</span>
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

      {config.enabled && (
        <div className="section-content">
          <div className="control-group">
            <label className="control-label">Cell size ({config.size}px)</label>
            <input
              type="range"
              min="4"
              max="50"
              value={config.size}
              onChange={(e) => handleChange({ size: Number(e.target.value) })}
              className="input-range"
            />
          </div>

          <div className="control-group">
            <label className="control-label">
              Major grid every {config.majorEvery > 0 ? `${config.majorEvery} cells` : 'Off'}
            </label>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={config.majorEvery}
              onChange={(e) => handleChange({ majorEvery: Number(e.target.value) })}
              className="input-range"
            />
          </div>

          <div className="control-group">
            <label className="control-label">Line weights</label>
            <div className="control-row" style={{ gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label
                  className="control-label"
                  style={{ fontSize: '11px', marginBottom: '4px', color: 'var(--color-text-secondary)' }}
                >
                  Minor ({config.minorLineWidth}px)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={config.minorLineWidth}
                  onChange={(e) => handleChange({ minorLineWidth: Number(e.target.value) })}
                  className="input-range"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  className="control-label"
                  style={{ fontSize: '11px', marginBottom: '4px', color: 'var(--color-text-secondary)' }}
                >
                  Major ({config.majorLineWidth}px)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={config.majorLineWidth}
                  onChange={(e) => handleChange({ majorLineWidth: Number(e.target.value) })}
                  className="input-range"
                />
              </div>
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">Color</label>
            <div className="control-row">
              <input
                type="color"
                value={config.color}
                onChange={(e) => handleChange({ color: e.target.value })}
                className="input-control"
              />
              <input
                type="text"
                value={config.color}
                onChange={(e) => handleChange({ color: e.target.value })}
                className="input-control"
                placeholder="#FF0000"
                style={{ flex: 1 }}
              />
            </div>
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
          </div>
        </div>
      )}
    </div>
  );
};
