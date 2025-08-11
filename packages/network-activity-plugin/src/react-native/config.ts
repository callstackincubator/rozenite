export type InspectorType = 'http' | 'websocket' | 'sse';

export type NetworkActivityDevToolsConfig = {
  /**
   * Specifies which network inspectors are enabled.
   * Set to `false` to disable monitoring for a specific type of network traffic.
   * @default { http: true, websocket: true, sse: true }
   */
  inspectors?: {
    [key in InspectorType]?: boolean;
  };
};

export const DEFAULT_CONFIG: NetworkActivityDevToolsConfig = {
  inspectors: {
    http: true,
    websocket: true,
    sse: true,
  },
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
