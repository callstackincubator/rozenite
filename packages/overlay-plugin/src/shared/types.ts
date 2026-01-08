export type GridConfig = {
  enabled: boolean;
  size: number;
  color: string;
  opacity: number;
};

export type ImageOverlayMode = 'overlay' | 'slider';
export type ImageResizeMode = 'cover' | 'contain' | 'stretch' | 'center';

export type ImageConfig = {
  enabled: boolean;
  opacity: number;
  uri: string | null;
  mode: ImageOverlayMode;
  resizeMode: ImageResizeMode;
};

export type OverlayState = {
  grid: GridConfig;
  image: ImageConfig;
};
