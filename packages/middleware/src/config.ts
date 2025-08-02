export type RozeniteConfig = {
  projectRoot: string;
  include?: string[];
  exclude?: string[];
  
  /**
   * Plugin identifiers that should NOT maintain their UI state when not active.
   * These panels will be destroyed instead of hidden when switching between panels.
   * If not provided (default), all plugins will persist their state.
   */
  destroyOnDetachPlugins?: string[];
};
