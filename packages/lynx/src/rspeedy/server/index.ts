/**
 * The transport-agnostic HTTP + WebSocket half of the Lynx dev server:
 * synthesises Metro's `/json/list` page list from a `LynxTransport`, and
 * runs the `/inspector/debug` WebSocket route that bridges each page to a
 * CDP-speaking host (`@rozenite/app`, exactly as it already speaks to
 * Metro).
 *
 * Takes the transport as a parameter rather than creating one — that is
 * what makes this half unit-testable against a fake, see
 * `./__tests__/`. `../index.ts` is the only caller that constructs a real
 * one (via `createLynxTransport`) and wires it in here.
 */
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { MiddlewareHandler } from '@rozenite/middleware';
import type { LynxTransport } from '../types.js';
import type { LynxTransportLogger } from '../transport/index.js';
import { createInspectorSocketRoute } from './inspector-socket.js';
import { createJsonListMiddleware } from './json-list.js';

export type Logger = LynxTransportLogger;

export type RozeniteLynxServerOptions = {
  transport: LynxTransport;
  logger?: Logger;
};

export type RozeniteLynxServer = {
  /** Express-compatible handler serving `GET /json/list`. Calls `next()`
   * for every other path. */
  middleware: MiddlewareHandler;
  /**
   * Returns true if it claimed the upgrade; false to leave it to others.
   * Must be wired to the *same* `http.Server`'s `'upgrade'` event as
   * everything else that also listens for one — in particular, whatever
   * bundler dev server hosts this (see `../index.ts`) has its own HMR
   * WebSocket on that same event, and a route here that swallowed every
   * upgrade unconditionally would silently break it.
   */
  handleUpgrade: (request: IncomingMessage, socket: Duplex, head: Buffer) => boolean;
  /**
   * Closes every open inspector socket and unsubscribes from the
   * transport. Safe to call twice. Does **not** dispose `transport` —
   * whoever constructed it (passed in via `options.transport`) owns its
   * lifecycle, not this server.
   */
  dispose: () => Promise<void>;
};

export const createRozeniteLynxServer = (
  options: RozeniteLynxServerOptions,
): RozeniteLynxServer => {
  const { transport, logger } = options;

  const middleware = createJsonListMiddleware(transport);
  const inspectorRoute = createInspectorSocketRoute({ transport, logger });

  return {
    middleware,
    handleUpgrade: inspectorRoute.handleUpgrade,
    dispose: async () => {
      inspectorRoute.dispose();
    },
  };
};

export {
  listInspectorTargets,
  GLOBAL_SESSION_ID,
  type InspectorTarget,
} from './inspector-targets.js';
export { computeLogicalDeviceId, findClientByLogicalDeviceId } from './logical-device-id.js';
