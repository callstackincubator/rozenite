export type InspectorType = 'http' | 'websocket' | 'sse';

export type InspectorsConfig = {
  [key in InspectorType]?: boolean;
};

export type NetworkInspectorConfig = {
  /**
   * Specifies which network inspectors are enabled.
   * Set to `false` to disable monitoring for a specific type of network traffic.
   * @default { http: true, websocket: true, sse: true }
   */
  inspectors?: InspectorsConfig;
};

export type NetworkActivityDevToolsConfig = NetworkInspectorConfig & {
  clientUISettings?: {
    /**
     * If true, display the entire relative URL as the request name in the UI instead of only the last path segment.
     * @default false
     */
    showUrlAsName?: boolean;
  };
};

export const DEFAULT_CONFIG: NetworkActivityDevToolsConfig = {
  inspectors: {
    http: true,
    websocket: true,
    sse: true,
  },
  clientUISettings: {
    showUrlAsName: false,
  }
};

export const validateConfig = (config: NetworkActivityDevToolsConfig): void => {
  const inspectors = config.inspectors;

  if (!inspectors) {
    return;
  }

  // For SSE, HTTP must be enabled
  if (inspectors.sse && !inspectors.http) {
    throw new Error('SSE inspector requires HTTP inspector to be enabled.');
  }
};
