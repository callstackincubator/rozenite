export { useRozeniteDevToolsClient } from './useRozeniteDevToolsClient';
export type { RozeniteDevToolsClient } from './client';
export type { Subscription } from './types';
export type { UseRozeniteDevToolsClientOptions } from './useRozeniteDevToolsClient';
export { getRozeniteDevToolsClient } from './client';
export { UnsupportedPlatformError } from './errors';

// v2 API (buffered, with handshake)
export * as unstable from './v2/index.js';
