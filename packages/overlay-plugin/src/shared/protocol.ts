import { GridConfig, ImageConfig } from './types';

export type OverlayPluginEventMap = {
  /**
   * Command to set the grid configuration.
   */
  'set-grid-config': { config: GridConfig };

  /**
   * Command to set the image overlay configuration.
   */
  'set-image-config': { config: ImageConfig };

  /**
   * Command to request the current overlay state.
   */
  'request-overlay-state': Record<string, never>;

  /**
   * Event containing the current overlay state.
   */
  'overlay-state': { grid: GridConfig; image: ImageConfig };
};