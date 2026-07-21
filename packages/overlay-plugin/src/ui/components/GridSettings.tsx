import { useEffect, useState } from 'react';
import {
  Card,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Description,
  parseColor,
  Slider,
  Switch,
} from '@rozenite/ui';
import { Grid } from 'lucide-react';
import { GridConfig } from '../../shared';
import { useThrottledCallback } from '../hooks/useThrottledCallback';

type SliderValue = number | number[];

export type GridSettingsProps = {
  config: GridConfig;
  onConfigChange: (config: GridConfig) => void;
};

const FALLBACK_GRID_COLOR = parseColor('#FF0000');

const getSliderNumber = (value: SliderValue) =>
  Array.isArray(value) ? (value[0] ?? 0) : value;

const getPickerColor = (value: string) => {
  try {
    return parseColor(value);
  } catch {
    return FALLBACK_GRID_COLOR;
  }
};

type SliderControlProps = {
  ariaLabel: string;
  label: string;
  maxValue: number;
  minValue: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
  valueLabel: string;
};

const SliderControl = ({
  ariaLabel,
  label,
  maxValue,
  minValue,
  onChange,
  step = 1,
  value,
  valueLabel,
}: SliderControlProps) => {
  return (
    <Slider
      aria-label={ariaLabel}
      className="gap-3"
      maxValue={maxValue}
      minValue={minValue}
      step={step}
      value={value}
      onChange={(nextValue) => onChange(getSliderNumber(nextValue))}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted">{valueLabel}</div>
      </div>
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  );
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

  const pickerColor = getPickerColor(config.color);

  return (
    <Card className="flex min-h-0 flex-col">
      <Card.Header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Card.Title className="flex items-center gap-2">
            <Grid className="size-4" />
            Grid overlay
          </Card.Title>
          <Card.Description className="mt-1 text-xs">
            Tune spacing, line emphasis, and color for layout checks.
          </Card.Description>
        </div>
        <Switch
          aria-label="Toggle grid overlay"
          isSelected={config.enabled}
          size="sm"
          onChange={(isSelected) => handleChange({ enabled: isSelected })}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </Card.Header>

      <Card.Content className="space-y-5">
        {config.enabled ? (
          <>
            <SliderControl
              ariaLabel="Grid cell size"
              label="Cell size"
              maxValue={50}
              minValue={4}
              value={config.size}
              valueLabel={`${config.size}px`}
              onChange={(value) => handleChange({ size: value })}
            />

            <SliderControl
              ariaLabel="Major grid interval"
              label="Major grid every"
              maxValue={20}
              minValue={0}
              value={config.majorEvery}
              valueLabel={
                config.majorEvery > 0 ? `${config.majorEvery} cells` : 'Off'
              }
              onChange={(value) => handleChange({ majorEvery: value })}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <SliderControl
                ariaLabel="Minor grid line width"
                label="Minor line"
                maxValue={10}
                minValue={1}
                value={config.minorLineWidth}
                valueLabel={`${config.minorLineWidth}px`}
                onChange={(value) => handleChange({ minorLineWidth: value })}
              />

              <SliderControl
                ariaLabel="Major grid line width"
                label="Major line"
                maxValue={10}
                minValue={1}
                value={config.majorLineWidth}
                valueLabel={`${config.majorLineWidth}px`}
                onChange={(value) => handleChange({ majorLineWidth: value })}
              />
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-foreground">Color</div>
                <Description className="mt-1 text-xs text-muted">
                  Pick the overlay stroke color used for both major and minor
                  lines.
                </Description>
              </div>

              <ColorPicker
                aria-label="Grid overlay color"
                value={pickerColor}
                onChange={(value) =>
                  handleChange({ color: value.toString('hex') })
                }
              >
                <ColorPicker.Trigger className="flex w-full items-center justify-between gap-3 rounded-md border border-border/70 bg-field-background px-3 py-2 text-left shadow-xs transition hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40">
                  <div className="flex min-w-0 items-center gap-3">
                    <ColorSwatch
                      className="size-6 shrink-0 rounded-md border border-border/70 shadow-xs"
                      color={pickerColor}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        Pick grid color
                      </div>
                      <div className="truncate text-xs text-muted">
                        {config.color}
                      </div>
                    </div>
                  </div>
                </ColorPicker.Trigger>

                <ColorPicker.Popover className="w-[min(20rem,calc(100vw-2rem))]">
                  <div className="space-y-4 p-4">
                    <ColorArea
                      aria-label="Grid color saturation and brightness"
                      colorSpace="hsb"
                      xChannel="saturation"
                      yChannel="brightness"
                    >
                      <ColorArea.Thumb />
                    </ColorArea>

                    <ColorSlider
                      aria-label="Grid color hue"
                      channel="hue"
                      colorSpace="hsb"
                    >
                      <ColorSlider.Track>
                        <ColorSlider.Thumb />
                      </ColorSlider.Track>
                    </ColorSlider>

                    <ColorField aria-label="Grid color value" fullWidth>
                      <ColorField.Group fullWidth>
                        <ColorField.Input />
                      </ColorField.Group>
                    </ColorField>
                  </div>
                </ColorPicker.Popover>
              </ColorPicker>
            </div>

            <SliderControl
              ariaLabel="Grid opacity"
              label="Opacity"
              maxValue={1}
              minValue={0}
              step={0.01}
              value={localOpacity}
              valueLabel={`${Math.round(localOpacity * 100)}%`}
              onChange={handleOpacityChange}
            />
          </>
        ) : (
          <Description className="text-sm text-muted">
            Enable the grid overlay to adjust spacing, line weight, and color.
          </Description>
        )}
      </Card.Content>
    </Card>
  );
};
