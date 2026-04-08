import { useRef, useState, useEffect, type ChangeEvent } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Label,
  RadioGroup,
  Slider,
  SliderFill,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  Switch,
  SwitchControl,
  SwitchThumb,
} from '@heroui/react';
import { ImageConfig, ImageResizeMode, MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_MB } from '../../shared';
import { Image as ImageIcon, Upload, X, Clipboard } from 'lucide-react';
import { useThrottledCallback } from '../hooks/useThrottledCallback';
import { RadioItem } from './RadioItem';

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

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
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

  const readSliderValue = (value: number | number[]) =>
    Array.isArray(value) ? value[0] ?? 0 : value;

  return (
    <Card className="border border-white/10 bg-[var(--overlay-surface)] shadow-2xl shadow-black/20 backdrop-blur-xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4 px-5 pb-3 pt-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-white">
            <ImageIcon size={18} />
            <span className="text-base font-semibold tracking-tight">Image overlay</span>
          </div>
          <p className="m-0 text-sm text-white/55">
            Compare against a reference image with overlay or slider mode.
          </p>
        </div>
        <Switch
          aria-label="Toggle image overlay"
          isSelected={config.enabled}
          onChange={(enabled: boolean) => handleChange({ enabled })}
        >
          <SwitchControl>
            <SwitchThumb />
          </SwitchControl>
        </Switch>
      </CardHeader>

      <CardContent className="gap-6 px-5 pb-5 pt-2">
        <div className="space-y-3">
          <div>
            <p className="m-0 text-sm font-medium text-white">Overlay image</p>
            <p className="m-0 mt-1 text-xs text-white/45">
              PNG, JPG, or pasted clipboard image up to {MAX_IMAGE_SIZE_MB}MB.
            </p>
          </div>
          {!config.uri ? (
            <div className="space-y-3">
              <div
                className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center"
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--overlay-line)] bg-[var(--overlay-accent-soft)] text-[var(--overlay-accent)]">
                  <Upload size={24} />
                </div>
                <div className="space-y-1">
                  <p className="m-0 text-sm font-medium text-white">
                    Click to upload a reference image
                  </p>
                  <p className="m-0 text-xs text-white/45">
                    Max size: {MAX_IMAGE_SIZE_MB}MB
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onPress={() => fileInputRef.current?.click()}
                >
                  <Upload size={16} />
                  Choose file
                </Button>
              </div>
              {isPasteSupported && (
                <Button
                  variant="outline"
                  onPress={handlePaste}
                  className="w-full border-white/15 bg-white/[0.02] text-white"
                >
                  <Clipboard size={16} />
                  Paste from Clipboard
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="danger-soft"
                  onPress={handleRemoveImage}
                >
                  <X size={16} />
                  Remove
                </Button>
              </div>
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/70">
                <img
                  src={config.uri}
                  alt="Overlay preview"
                  className="block h-64 w-full object-contain bg-[linear-gradient(45deg,#0a1824_25%,transparent_25%),linear-gradient(-45deg,#0a1824_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#0a1824_75%),linear-gradient(-45deg,transparent_75%,#0a1824_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0]"
                />
              </div>
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
            <div className="flex flex-wrap items-center gap-3">
              <Label className="text-sm font-medium text-white">Mode</Label>
              <RadioGroup
                aria-label="Image comparison mode"
                className="inline-flex flex-row items-center gap-[0.35rem] rounded-[0.85rem] border border-[var(--overlay-line)] bg-white/[0.03] p-[0.2rem]"
                orientation="horizontal"
                value={config.mode}
                onChange={(mode: string) =>
                  handleChange({ mode: mode as ImageConfig['mode'] })
                }
              >
                <RadioItem value="overlay" label="Simple overlay" />
                <RadioItem value="slider" label="Slider comparison" />
              </RadioGroup>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Label className="text-sm font-medium text-white">Resize mode</Label>
              <RadioGroup
                aria-label="Image resize mode"
                className="inline-flex flex-row flex-wrap items-center gap-[0.35rem] rounded-[0.85rem] border border-[var(--overlay-line)] bg-white/[0.03] p-[0.2rem]"
                orientation="horizontal"
                value={config.resizeMode}
                onChange={(resizeMode: string) =>
                  handleChange({ resizeMode: resizeMode as ImageResizeMode })
                }
              >
                <RadioItem value="contain" label="Contain" />
                <RadioItem value="cover" label="Cover" />
                <RadioItem value="stretch" label="Stretch" />
                <RadioItem value="center" label="Center" />
              </RadioGroup>
            </div>

            <Slider
              aria-label="Image opacity"
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
            {config.mode === 'slider' && (
              <p className="m-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/55">
                Drag the divider handle on your device to compare the reference image.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
