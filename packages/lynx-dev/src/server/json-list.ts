/**
 * `GET /json/list` — synthesises the same shape Metro's inspector proxy
 * serves, from a `LynxTransport`, so `@rozenite/app` (which only ever
 * speaks Metro's dialect — see
 * `packages/app/src/connection/metro-target-resolution.ts`) never has to
 * learn that Lynx exists.
 */
import type { MiddlewareHandler } from '@rozenite/middleware';
import type { LynxTransport } from '../types.js';
import { type InspectorTarget, listInspectorTargets } from './inspector-targets.js';
import { resolveWebSocketOrigin } from './request-origin.js';

const JSON_LIST_PATH = '/json/list';

type JsonPageDescription = {
  id: string;
  title: string;
  description: string;
  appId: string;
  type: 'node';
  deviceName: string;
  webSocketDebuggerUrl: string;
  reactNative: {
    logicalDeviceId: string;
    capabilities: {
      prefersFuseboxFrontend: boolean;
    };
  };
};

const buildPage = (target: InspectorTarget, origin: string): JsonPageDescription => {
  const { client, logicalDeviceId, sessionId, title } = target;
  return {
    id: `${logicalDeviceId}-${sessionId}`,
    title,
    description: client.appName,
    appId: client.appName,
    type: 'node',
    deviceName: `${client.deviceName} (${client.os})`,
    webSocketDebuggerUrl: `${origin}/inspector/debug?device=${logicalDeviceId}&page=${sessionId}`,
    reactNative: {
      logicalDeviceId,
      capabilities: {
        // Unconditionally true: unlike Metro/React Native, there is no
        // legacy (non-Fusebox) frontend for Lynx to fall back to, so every
        // page is always eligible for it. This is also what
        // `metro-target-resolution.ts`'s `sortPages` sorts on first —
        // with every page tied at 1, selection falls through to its `id`
        // tiebreaker, which is fine, since at most one page ever shares a
        // `logicalDeviceId` with a given `page` (session) id anyway.
        prefersFuseboxFrontend: true,
      },
    },
  };
};

export const createJsonListMiddleware = (transport: LynxTransport): MiddlewareHandler => {
  const middleware: MiddlewareHandler = (req, res, next) => {
    const pathname = (req.url ?? '').split('?', 1)[0];
    if (pathname !== JSON_LIST_PATH) {
      next();
      return;
    }

    const origin = resolveWebSocketOrigin(req);
    const pages = listInspectorTargets(transport).map((target) => buildPage(target, origin));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(pages));
  };

  return middleware;
};
