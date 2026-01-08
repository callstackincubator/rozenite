import { useRef, useState, useEffect } from 'react';
import { GridConfig } from '../../shared/types';
import { Grid } from 'lucide-react';

export type GridSettingsProps = {
  config: GridConfig;
  onConfigChange: (config: GridConfig) => void;
};

export const GridSettings = ({ config, onConfigChange }: GridSettingsProps) => {
  const [localOpacity, setLocalOpacity] = useState(config.opacity);
  const opacityTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setLocalOpacity(config.opacity);
  }, [config.opacity]);

  const handleChange = (changes: Partial<GridConfig>) => {
    onConfigChange({ ...config, ...changes });
  };

  const handleOpacityChange = (value: number) => {
    setLocalOpacity(value);
    
    if (opacityTimeoutRef.current) {
      clearTimeout(opacityTimeoutRef.current);
    }

    opacityTimeoutRef.current = setTimeout(() => {
      handleChange({ opacity: value });
    }, 50);
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
