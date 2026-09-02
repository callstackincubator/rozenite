/**
 * The single place that touches `@lynx-js/debug-router-connector`.
 *
 * The package is CJS-only (no `types` field, no `exports` map) and pulls in
 * `@aws-sdk/client-s3`, `@devicefarmer/adbkit`, `axios` and friends, so it is
 * loaded defensively with `createRequire`, typed via `typeof import(...)`,
 * and only `require`d from inside `createRealConnector` — never at module
 * load time — so importing this module stays cheap.
 */
import { createRequire } from 'node:module';
import type { ConnectorLike } from './connector-types.js';

const require = createRequire(import.meta.url);

/**
 * Constructs the real `DebugRouterConnector` and casts it down to
 * `ConnectorLike`.
 *
 * The cast goes through `unknown` rather than a direct assignment: `on`/`off`
 * on the real connector are generic over the full `DebugerRouterDriverEvents`
 * map (a strict superset of `ConnectorEventMap`, keyed the same way for the
 * events we use), and TypeScript does not structurally verify that one
 * generic method is a valid narrowing of another — an exact structural match
 * without a cast is not achievable here. Every other member (`connectDevices`,
 * `startWatchAllClients`, `close`) matches `ConnectorLike` on its own.
 */
export const createRealConnector = (options: unknown): ConnectorLike => {
  type ConnectorModule = typeof import('@lynx-js/debug-router-connector');
  const { DebugRouterConnector } = require('@lynx-js/debug-router-connector') as ConnectorModule;
  return new DebugRouterConnector(options as never) as unknown as ConnectorLike;
};
