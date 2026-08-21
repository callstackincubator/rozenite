/**
 * Turns a `LynxTransport`'s current clients into the flat list of
 * inspector targets `/json/list` (`./json-list.ts`) and the "DevTools URL
 * available" log (`../index.ts`) both need — kept in one place so the two
 * can never disagree on what counts as a target.
 */
import type { LynxClient, LynxTransport } from '../types.js';
import { computeLogicalDeviceId } from './logical-device-id.js';

/**
 * DebugRouter's "address the client globally" session id (see
 * `../types.ts`'s doc comment on `LynxSession.sessionId`). Used only to
 * recognise that id elsewhere (`inspector-socket.ts`'s topology guard) —
 * `listInspectorTargets` below never emits it. A client with no cards used
 * to fall back to a single `-1` target ("the whole app"), but that page can
 * never actually work: on-device, DebugRouter's CDP dispatcher registers
 * the `Runtime` domain (and everything else Rozenite's bootstrap needs)
 * only on a per-card session created by `Attach(url)`
 * (`LynxDevToolNG::RegisterInstanceDomainAgents` in the Lynx engine); the
 * app-global dispatcher (`RegisterGlobalDomainAgents`) never registers it.
 * A host that connects to `-1` gets `{"error":{"code":-32601,"message":
 * "Not implemented: Runtime.enable"}}` back from the very first command
 * `device-connection.ts` sends, which fails the connection immediately —
 * turning an honest "no cards yet" into a page that looks connectable and
 * then dies. An empty `/json/list` is the correct, honest answer instead.
 */
export const GLOBAL_SESSION_ID = -1;

export type InspectorTarget = {
  logicalDeviceId: string;
  sessionId: number;
  /** Card template URL. */
  title: string;
  client: LynxClient;
};

const buildClientTargets = (client: LynxClient, transport: LynxTransport): InspectorTarget[] => {
  const logicalDeviceId = computeLogicalDeviceId(client);
  const sessions = transport.listSessions(client.clientId);

  return sessions.map((session) => ({
    logicalDeviceId,
    sessionId: session.sessionId,
    title: session.url || `Lynx card ${session.sessionId}`,
    client,
  }));
};

export const listInspectorTargets = (transport: LynxTransport): InspectorTarget[] =>
  transport.listClients().flatMap((client) => buildClientTargets(client, transport));
