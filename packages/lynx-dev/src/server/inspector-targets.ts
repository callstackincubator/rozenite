/**
 * Turns a `LynxTransport`'s current clients into the flat list of
 * inspector targets `/json/list` (`./json-list.ts`) and the "DevTools URL
 * available" log (`../index.ts`) both need — kept in one place so the two
 * can never disagree on what counts as a target, in particular on the
 * zero-session fallback rule below.
 */
import type { LynxClient, LynxTransport } from '../types.js';
import { computeLogicalDeviceId } from './logical-device-id.js';

/**
 * DebugRouter's "address the client globally" session id (see
 * `../types.ts`'s doc comment on `LynxSession.sessionId`), reused as the
 * page id for a client with no reported cards yet — see
 * `listInspectorTargets` below.
 */
export const GLOBAL_SESSION_ID = -1;

export type InspectorTarget = {
  logicalDeviceId: string;
  sessionId: number;
  /** Card template URL, or a description of the whole-app fallback page. */
  title: string;
  client: LynxClient;
};

const buildClientTargets = (client: LynxClient, transport: LynxTransport): InspectorTarget[] => {
  const logicalDeviceId = computeLogicalDeviceId(client);
  const sessions = transport.listSessions(client.clientId);

  if (sessions.length === 0) {
    // A session list is pushed by the app itself, asynchronously —
    // `createLynxTransport` requests it on connect and again on a refresh
    // timer, but there is always a window (and, for an app that never
    // opens a LynxView, forever) where it is still empty. A client in
    // that state still needs *something* in `/json/list`, or it is
    // simply invisible to `@rozenite/app`: Rozenite's own device-side
    // runtime lives in the background runtime, which DebugRouter's `-1`
    // session id addresses globally, so that is exactly the target such
    // a client gets — one entry, titled so it obviously reads as the
    // whole app rather than one of its cards. Once real cards are
    // reported they fully describe the client, and this fallback
    // disappears: a card and the global entry would otherwise be two
    // indistinguishable targets for the same underlying connection.
    return [
      {
        logicalDeviceId,
        sessionId: GLOBAL_SESSION_ID,
        title: `${client.appName} (whole app)`,
        client,
      },
    ];
  }

  return sessions.map((session) => ({
    logicalDeviceId,
    sessionId: session.sessionId,
    title: session.url || `Lynx card ${session.sessionId}`,
    client,
  }));
};

export const listInspectorTargets = (transport: LynxTransport): InspectorTarget[] =>
  transport.listClients().flatMap((client) => buildClientTargets(client, transport));
