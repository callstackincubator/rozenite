import { GridConfig, ImageConfig } from './types';

/**
 * Protocol exposed by the App (React Native) side.
 * These methods can be called from the DevTools side.
 */
export type OverlayAppProtocol = {
  /**
   * Set the grid configuration.
   * @param config - The grid configuration
   */
  setGridConfig(config: GridConfig): Promise<void>;

  /**
   * Set the image overlay configuration.
   * @param config - The image configuration
   */
  setImageConfig(config: ImageConfig): Promise<void>;

  /**
   * Get the current overlay state.
   * @returns The current overlay state
   */
  getOverlayState(): Promise<{ grid: GridConfig; image: ImageConfig }>;
};

/**
 * Protocol exposed by the DevTools side.
 * These methods can be called from the App (React Native) side.
 * Currently empty, but can be extended in the future.
 */
export type OverlayDevToolsProtocol = {
  // Future: Could add methods like refresh(), showNotification(), etc.
};

