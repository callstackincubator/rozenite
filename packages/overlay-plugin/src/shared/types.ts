export type GridConfig = {
  enabled: boolean;
  size: number;
  color: string;
  opacity: number;
};

export type ImageConfig = {
  enabled: boolean;
  opacity: number;
  uri: string | null;
};

export type OverlayState = {
  grid: GridConfig;
  image: ImageConfig;
};

