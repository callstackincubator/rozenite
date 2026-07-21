import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Description,
  ListBox,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Surface,
  Switch,
} from '@rozenite/ui';
import { Clipboard, Image as ImageIcon, Upload, X } from 'lucide-react';
import {
  ImageConfig,
  ImageOverlayMode,
  ImageResizeMode,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_MB,
} from '../../shared';
import { useThrottledCallback } from '../hooks/useThrottledCallback';

type SliderValue = number | number[];

export type ImageSettingsProps = {
  config: ImageConfig;
  onConfigChange: (config: ImageConfig) => void;
};

const resizeModeOptions: Array<{
  label: string;
  value: ImageResizeMode;
}> = [
  { label: 'Contain', value: 'contain' },
  { label: 'Cover', value: 'cover' },
  { label: 'Stretch', value: 'stretch' },
  { label: 'Center', value: 'center' },
];

const getSliderNumber = (value: SliderValue) =>
  Array.isArray(value) ? (value[0] ?? 0) : value;

export const ImageSettings = ({
  config,
  onConfigChange,
}: ImageSettingsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localOpacity, setLocalOpacity] = useState(config.opacity);
  const [isPasteSupported] = useState(
    () => navigator.clipboard && 'read' in navigator.clipboard,
  );

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
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      alert(
        `Image size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed size of ${MAX_IMAGE_SIZE_MB}MB.`,
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      handleChange({ uri: base64, enabled: true });
    };
    reader.onerror = () => {
      alert('Error reading image file');
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    processFile(file);
  };

  const handlePaste = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();

      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          processFile(blob);
          return;
        }
      }

      alert('No image found in clipboard');
    } catch (error) {
      console.error('Failed to read clipboard contents: ', error);
      alert(
        'Failed to access clipboard. Please ensure you have granted permission.',
      );
    }
  };

  const handleRemoveImage = () => {
    handleChange({ uri: null, enabled: false });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleModeChange = (value: string) => {
    handleChange({ mode: value as ImageOverlayMode });
  };

  return (
    <Card className="flex min-h-0 flex-col">
      <Card.Header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Card.Title className="flex items-center gap-2">
            <ImageIcon className="size-4" />
            Image overlay
          </Card.Title>
          <Card.Description className="mt-1 text-xs">
            Compare the app against reference imagery without leaving DevTools.
          </Card.Description>
        </div>
        <Switch
          aria-label="Toggle image overlay"
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
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-foreground">
              Overlay image
            </div>
            <Description className="mt-1 text-xs text-muted">
              Upload a design reference or paste directly from the clipboard.
            </Description>
          </div>

          {!config.uri ? (
            <div className="space-y-3">
              <Surface
                className="relative overflow-hidden border border-dashed border-border/70 bg-linear-to-b from-surface-secondary/80 to-surface px-6 py-7"
                variant="secondary"
              >
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-accent/45 to-transparent" />

                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Upload className="size-7" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-sm font-semibold text-foreground">
                      Add a reference image
                    </div>
                    <Description className="mx-auto max-w-xs text-xs leading-5 text-muted">
                      Choose a file or paste a screenshot to compare it against
                      the running screen.
                    </Description>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      size="sm"
                      onPress={() => fileInputRef.current?.click()}
                    >
                      Choose image
                    </Button>

                    {isPasteSupported ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={handlePaste}
                      >
                        <Clipboard className="size-4" />
                        Paste screenshot
                      </Button>
                    ) : null}
                  </div>

                  <Description className="text-[11px] uppercase tracking-[0.14em] text-muted">
                    Max size {MAX_IMAGE_SIZE_MB}MB
                  </Description>
                </div>
              </Surface>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="danger" onPress={handleRemoveImage}>
                  <X className="size-4" />
                  Remove
                </Button>
              </div>

              <Surface className="overflow-hidden p-2" variant="secondary">
                <img
                  alt="Overlay preview"
                  className="max-h-[24rem] w-full rounded-md object-contain"
                  src={config.uri}
                />
              </Surface>
            </div>
          )}

          <input
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            type="file"
            onChange={handleFileSelect}
          />
        </div>

        {config.enabled && config.uri ? (
          <>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-foreground">Mode</div>
                <Description className="mt-1 text-xs text-muted">
                  Pick the comparison style that fits the screen you are
                  reviewing.
                </Description>
              </div>

              <RadioGroup
                aria-label="Overlay comparison mode"
                className="grid gap-2 sm:grid-cols-2"
                value={config.mode}
                onChange={handleModeChange}
              >
                <Radio
                  className="rounded-md border border-border/70 bg-surface-secondary/40 p-3"
                  value="overlay"
                >
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  <Radio.Content>
                    <div className="text-sm font-medium text-foreground">
                      Simple overlay
                    </div>
                    <Description className="mt-1 text-xs text-muted">
                      Layer the reference image directly over the app.
                    </Description>
                  </Radio.Content>
                </Radio>

                <Radio
                  className="rounded-md border border-border/70 bg-surface-secondary/40 p-3"
                  value="slider"
                >
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  <Radio.Content>
                    <div className="text-sm font-medium text-foreground">
                      Slider comparison
                    </div>
                    <Description className="mt-1 text-xs text-muted">
                      Drag a divider on the device to compare both versions.
                    </Description>
                  </Radio.Content>
                </Radio>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-foreground">
                  Resize mode
                </div>
                <Description className="mt-1 text-xs text-muted">
                  Control how the reference image fits the available screen
                  space.
                </Description>
              </div>

              <Select
                aria-label="Image resize mode"
                value={config.resizeMode}
                variant="secondary"
                onChange={(value) => {
                  if (typeof value === 'string') {
                    handleChange({ resizeMode: value as ImageResizeMode });
                  }
                }}
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox aria-label="Resize mode options">
                    {resizeModeOptions.map((option) => (
                      <ListBox.Item
                        key={option.value}
                        id={option.value}
                        textValue={option.label}
                      >
                        {option.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            <Slider
              aria-label="Image overlay opacity"
              className="gap-3"
              maxValue={1}
              minValue={0}
              step={0.01}
              value={localOpacity}
              onChange={(value) =>
                handleOpacityChange(getSliderNumber(value))
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">
                  Opacity
                </div>
                <div className="text-xs text-muted">
                  {Math.round(localOpacity * 100)}%
                </div>
              </div>
              <Slider.Track>
                <Slider.Fill />
                <Slider.Thumb />
              </Slider.Track>
            </Slider>

            {config.mode === 'slider' ? (
              <Description className="text-xs text-muted">
                Drag the divider handle on your device to compare.
              </Description>
            ) : null}
          </>
        ) : null}
      </Card.Content>
    </Card>
  );
};
