import { useState, useEffect, type ChangeEvent } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
  Slider,
  SliderFill,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  Switch,
  SwitchControl,
  SwitchThumb,
} from '@heroui/react';
import { GridConfig } from '../../shared';
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

  const readSliderValue = (value: number | number[]) =>
    Array.isArray(value) ? value[0] ?? 0 : value;

  return (
    <Card className="border border-white/10 bg-[var(--overlay-surface)] shadow-2xl shadow-black/20 backdrop-blur-xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4 px-5 pb-3 pt-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-white">
            <Grid size={18} />
            <span className="text-base font-semibold tracking-tight">Grid overlay</span>
          </div>
          <p className="m-0 text-sm text-white/55">
            Tune the grid density, emphasis, and visibility directly on-device.
          </p>
        </div>
        <Switch
          aria-label="Toggle grid overlay"
          isSelected={config.enabled}
          onChange={(enabled: boolean) => handleChange({ enabled })}
        >
          <SwitchControl>
            <SwitchThumb />
          </SwitchControl>
        </Switch>
      </CardHeader>

      {config.enabled && (
        <CardContent className="gap-6 px-5 pb-5 pt-2">
          <Slider
            aria-label="Cell size"
            minValue={4}
            maxValue={50}
            step={1}
            value={config.size}
            onChange={(value: number | number[]) =>
              handleChange({ size: readSliderValue(value) })
            }
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white">Cell size</span>
              <SliderOutput className="text-sm text-white/55">{config.size}px</SliderOutput>
            </div>
            <SliderTrack>
              <SliderFill />
              <SliderThumb />
            </SliderTrack>
          </Slider>

          <Slider
            aria-label="Major grid frequency"
            minValue={0}
            maxValue={20}
            step={1}
            value={config.majorEvery}
            onChange={(value: number | number[]) =>
              handleChange({ majorEvery: readSliderValue(value) })
            }
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white">Major grid every</span>
              <SliderOutput className="text-sm text-white/55">
                {config.majorEvery > 0 ? `${config.majorEvery} cells` : 'Off'}
              </SliderOutput>
            </div>
            <SliderTrack>
              <SliderFill />
              <SliderThumb />
            </SliderTrack>
          </Slider>

          <div className="grid gap-4 md:grid-cols-2">
            <Slider
              aria-label="Minor line weight"
              minValue={1}
              maxValue={10}
              step={1}
              value={config.minorLineWidth}
              onChange={(value: number | number[]) =>
                handleChange({ minorLineWidth: readSliderValue(value) })
              }
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white">Minor line weight</span>
                <SliderOutput className="text-sm text-white/55">
                  {config.minorLineWidth}px
                </SliderOutput>
              </div>
              <SliderTrack>
                <SliderFill />
                <SliderThumb />
              </SliderTrack>
            </Slider>
            <Slider
              aria-label="Major line weight"
              minValue={1}
              maxValue={10}
              step={1}
              value={config.majorLineWidth}
              onChange={(value: number | number[]) =>
                handleChange({ majorLineWidth: readSliderValue(value) })
              }
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white">Major line weight</span>
                <SliderOutput className="text-sm text-white/55">
                  {config.majorLineWidth}px
                </SliderOutput>
              </div>
              <SliderTrack>
                <SliderFill />
                <SliderThumb />
              </SliderTrack>
            </Slider>
          </div>

          <div className="grid gap-3 md:grid-cols-[96px_minmax(0,1fr)]">
            <Input
              id="grid-color-picker"
              aria-label="Grid color picker"
              type="color"
              value={config.color}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                handleChange({ color: event.target.value })
              }
              className="w-full"
            />
            <div className="space-y-2">
              <Label htmlFor="grid-color-input" className="text-sm font-medium text-white">
                Grid color
              </Label>
              <Input
                id="grid-color-input"
                value={config.color}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  handleChange({ color: event.target.value })
                }
                placeholder="#FF0000"
              />
            </div>
          </div>

          <Slider
            aria-label="Grid opacity"
            minValue={0}
            maxValue={1}
            step={0.01}
            value={localOpacity}
            onChange={(value: number | number[]) =>
              handleOpacityChange(readSliderValue(value))
            }
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white">Opacity</span>
              <SliderOutput className="text-sm text-white/55">
                {Math.round(localOpacity * 100)}%
              </SliderOutput>
            </div>
            <SliderTrack>
              <SliderFill />
              <SliderThumb />
            </SliderTrack>
          </Slider>
        </CardContent>
      )}
    </Card>
  );
};
