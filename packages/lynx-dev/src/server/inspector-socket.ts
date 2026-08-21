/**
 * The `/inspector/debug` WebSocket route: one socket per
 * `(logicalDeviceId, sessionId)` pair, running the DebugRouter <-> CDP
 * bridge from `../bridge/` over it.
 *
 * Runs `ws` in `noServer` mode, so `handleUpgrade` can decide per-request
 * whether this route claims the upgrade at all — see `../index.ts` for
 * why that decision has to be made this way (in short: the same
 * `http.Server` also carries Rsbuild's own HMR WebSocket, and this route
 * must never swallow an upgrade meant for it).
 */
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import {
  type BridgeCloseCause,
  getCloseReason,
  translateDeviceFrame,
  translateHostMessage,
} from '../bridge/index.js';
import type { DeviceFrame, LynxTransport } from '../types.js';
import { GLOBAL_SESSION_ID } from './inspector-targets.js';
import { findClientByLogicalDeviceId } from './logical-device-id.js';

export type InspectorSocketLogger = {
  debug: (message: string) => void;
  warn: (message: string) => void;
};

export type InspectorSocketRouteOptions = {
  transport: LynxTransport;
  logger?: InspectorSocketLogger;
};

export type InspectorSocketRoute = {
  /** Returns true if it claimed the upgrade; false to leave it to others. */
  handleUpgrade: (request: IncomingMessage, socket: Duplex, head: Buffer) => boolean;
  dispose: () => void;
};

const noopLogger: InspectorSocketLogger = { debug: () => {}, warn: () => {} };

/** The one path this route serves, plus its `/rozenite`-scoped alias — for
 * symmetry with how `../index.ts` mounts the Rozenite middleware under
 * `/rozenite`, in case a reverse proxy forwards upgrades the same way it
 * forwards the rest of the traffic under that prefix. */
const INSPECTOR_PATHS = new Set(['/inspector/debug', '/rozenite/inspector/debug']);

/** Close code paired with every reason string from `getCloseReason` —
 * "abnormal closure", the code Fusebox's own inspector proxy uses for the
 * same class of close. */
const CLOSE_CODE_ABNORMAL = 1011;

const isIntegerString = (value: string | null): value is string =>
  value !== null && /^-?\d+$/.test(value);

type SocketEntry = {
  ws: WebSocket;
  logicalDeviceId: string;
  sessionId: number;
  /**
   * The `LynxClient.clientId` this socket resolved to when it connected.
   * Fixed for the socket's whole lifetime rather than re-resolved: a
   * client only ever gets a new `clientId` by fully re-registering with
   * DebugRouter, and that always tears the *old* registration down
   * first — which is what `client-disconnected` below reacts to, closing
   * this socket before a reconnection could ever give it a reason to
   * want a different `clientId`.
   */
  clientId: number;
};

const isExecutionContextsClearedMessage = (message: unknown): boolean =>
  typeof message === 'object' &&
  message !== null &&
  (message as { method?: unknown }).method === 'Runtime.executionContextsCleared';

/**
 * Synthesised immediately after forwarding a device's own
 * `Runtime.executionContextsCleared` event to the host. Lynx's V8
 * inspector backend does emit that event on a reload
 * (`lynx/devtool/lynx_devtool/js_debug/inspector_client_delegate_impl.cc:646-653`),
 * but nothing in Lynx ever emits `Runtime.executionContextCreated` back —
 * it only happens implicitly on the V8 backend, through the real V8
 * inspector; the QuickJS/PrimJS backend that ships on-device by default
 * has no equivalent at all. Without this,
 * `packages/app/src/connection/device-connection.ts`'s
 * `handleSocketMessage` sets `reloading` on `executionContextsCleared`
 * and then sits there forever waiting for a `main`-named context that
 * PrimJS will never send, and the connection never recovers from a
 * reload.
 *
 * Safe to send even when the device *is* running the V8 backend and a
 * real `executionContextCreated` follows (after
 * `../bridge/translate-device-frame.ts`'s `rewriteBackgroundContextAsMain`
 * has already renamed it to `"main"`): the host debounces
 * `executionContextCreated` by 500ms (`BOOTSTRAP_DEBOUNCE_MS`) and guards
 * the actual re-bootstrap work with an in-flight flag, so the two
 * arrivals collapse into a single re-bootstrap rather than running it
 * twice. And if the app has not actually finished reloading by the time
 * this synthetic event arrives, that is fine too — the re-bootstrap's own
 * `waitForDispatcher` polls for the dispatcher global up to 19 times,
 * 250ms apart, before giving up, which is what absorbs the remaining
 * startup time.
 */
const SYNTHETIC_EXECUTION_CONTEXT_CREATED = {
  method: 'Runtime.executionContextCreated',
  params: { context: { id: 1, name: 'main', origin: '', uniqueId: '1' } },
};

export const createInspectorSocketRoute = (
  options: InspectorSocketRouteOptions,
): InspectorSocketRoute => {
  const { transport } = options;
  const logger = options.logger ?? noopLogger;
  const wss = new WebSocketServer({ noServer: true });
  const sockets = new Map<string, SocketEntry>();
  let disposed = false;

  const socketKey = (logicalDeviceId: string, sessionId: number): string =>
    `${logicalDeviceId}:${sessionId}`;

  const closeEntry = (entry: SocketEntry, cause: BridgeCloseCause): void => {
    try {
      entry.ws.close(CLOSE_CODE_ABNORMAL, getCloseReason(cause));
    } catch (error) {
      logger.warn(`[lynx-dev] Failed to close inspector socket: ${String(error)}`);
    }
  };

  const registerSocket = (
    ws: WebSocket,
    logicalDeviceId: string,
    sessionId: number,
    clientId: number,
  ): void => {
    const key = socketKey(logicalDeviceId, sessionId);

    const existing = sockets.get(key);
    if (existing) {
      // Detach before closing: the superseded socket's own `close`
      // handler (below) must not delete *this* connection's entry if the
      // two `close` events happen to race.
      sockets.delete(key);
      closeEntry(existing, 'superseded');
    }

    const entry: SocketEntry = { ws, logicalDeviceId, sessionId, clientId };
    sockets.set(key, entry);

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        logger.debug('[lynx-dev] Dropped binary host message.');
        return;
      }
      const action = translateHostMessage(data.toString());
      if (action.kind === 'reply') {
        ws.send(JSON.stringify(action.message));
      } else if (action.kind === 'forward') {
        transport.sendCdpMessage(entry.clientId, entry.sessionId, action.message);
      } else {
        logger.debug(`[lynx-dev] Dropped host message: ${action.reason}`);
      }
    });

    ws.on('close', () => {
      if (sockets.get(key) === entry) {
        sockets.delete(key);
      }
    });
  };

  const sendToEntry = (entry: SocketEntry, message: unknown): void => {
    if (entry.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    entry.ws.send(JSON.stringify(message));
    if (isExecutionContextsClearedMessage(message)) {
      entry.ws.send(JSON.stringify(SYNTHETIC_EXECUTION_CONTEXT_CREATED));
    }
  };

  // One subscription fanning out to every open socket, rather than one
  // subscription per socket — see `RozeniteLynxServerOptions`'s doc
  // comment in `./index.ts`.
  const unsubscribeFrames = transport.onDeviceFrame((frame: DeviceFrame) => {
    const action = translateDeviceFrame(frame);
    if (action.kind === 'drop') {
      logger.debug(`[lynx-dev] Dropped device frame: ${action.reason}`);
      return;
    }
    for (const entry of sockets.values()) {
      if (entry.clientId === frame.clientId && entry.sessionId === frame.sessionId) {
        sendToEntry(entry, action.message);
      }
    }
  });

  const unsubscribeTopology = transport.onTopologyChanged(() => {
    const clients = transport.listClients();
    for (const entry of Array.from(sockets.values())) {
      const client = findClientByLogicalDeviceId(clients, entry.logicalDeviceId);
      if (!client) {
        sockets.delete(socketKey(entry.logicalDeviceId, entry.sessionId));
        closeEntry(entry, 'client-disconnected');
        continue;
      }

      // The same logical device came back under a different DebugRouter
      // registration. `entry.clientId` is a snapshot (see `SocketEntry`),
      // so this socket would otherwise keep addressing a client that no
      // longer exists and silently go deaf. In practice a reconnect
      // always tears the old registration down first, which the branch
      // above already turns into a close — this is the belt to that
      // braces, and it closes with the same recoverable reason so the
      // host re-resolves through `/json/list` and reconnects.
      if (client.clientId !== entry.clientId) {
        sockets.delete(socketKey(entry.logicalDeviceId, entry.sessionId));
        closeEntry(entry, 'client-disconnected');
        continue;
      }

      // A `-1` socket addresses the client as a whole — there is no card
      // to go missing, only the client itself, already handled above.
      if (entry.sessionId === GLOBAL_SESSION_ID) {
        continue;
      }

      const sessions = transport.listSessions(client.clientId);
      const stillPresent = sessions.some((session) => session.sessionId === entry.sessionId);
      if (!stillPresent) {
        sockets.delete(socketKey(entry.logicalDeviceId, entry.sessionId));
        closeEntry(entry, 'session-gone');
      }
    }
  });

  const handleUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): boolean => {
    if (disposed) {
      return false;
    }

    const pathname = (request.url ?? '').split('?', 1)[0];
    if (!INSPECTOR_PATHS.has(pathname)) {
      return false;
    }

    const url = new URL(request.url ?? '', 'http://inspector.invalid');
    const logicalDeviceId = url.searchParams.get('device');
    const pageParam = url.searchParams.get('page');

    wss.handleUpgrade(request, socket, head, (ws) => {
      // Unknown device, or a page that isn't an integer: complete the
      // upgrade and then close with a reason, rather than destroying the
      // socket outright — the host's recovery logic
      // (`device-connection.ts`'s `handleClose`) only runs when it sees a
      // close *reason*; a torn-down socket gives it nothing to act on.
      if (!logicalDeviceId || !isIntegerString(pageParam)) {
        ws.close(CLOSE_CODE_ABNORMAL, getCloseReason('session-gone'));
        return;
      }

      const sessionId = Number(pageParam);
      const client = findClientByLogicalDeviceId(transport.listClients(), logicalDeviceId);
      if (!client) {
        ws.close(CLOSE_CODE_ABNORMAL, getCloseReason('session-gone'));
        return;
      }

      registerSocket(ws, logicalDeviceId, sessionId, client.clientId);
    });

    return true;
  };

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;

    unsubscribeFrames();
    unsubscribeTopology();

    for (const entry of sockets.values()) {
      entry.ws.terminate();
    }
    sockets.clear();

    wss.close();
  };

  return { handleUpgrade, dispose };
};
