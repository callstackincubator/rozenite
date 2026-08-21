/**
 * DebugRouter transport: discovers Lynx clients over USB, tracks their
 * cards, and ships raw CDP frames in both directions. This is the only
 * module in the package that knows about DebugRouter's wire format; see
 * `../types.ts` for the vocabulary-neutral seam it implements.
 */
import type { DeviceFrame, LynxClient, LynxSession, LynxTransport } from '../types.js';
import type { ClientLike, ConnectorLike } from './connector-types.js';
import { createRealConnector } from './connector.js';
import { buildCdpEnvelope, buildListSessionEnvelope, parseInboundMessage } from './wire.js';

export type {
  ClientLike,
  ClientQueryLike,
  ConnectorEventMap,
  ConnectorLike,
} from './connector-types.js';

export type LynxTransportLogger = {
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export type LynxTransportOptions = {
  /** Restrict discovery to one device serial/udid. */
  deviceSerial?: string;
  /**
   * Platform toggles, forwarded to DebugRouterConnector. Android, iOS and
   * desktop are on by default; Harmony is opt-in.
   *
   * `enableDesktop` covers more than its name suggests, and turning it off
   * is how you lose simulators. The Android and iOS paths discover
   * *physical* devices only, over adb and usbmux respectively. An iOS
   * Simulator is an ordinary macOS process, so DebugRouter inside it is
   * reachable on `127.0.0.1:8901-8919` — which is exactly what the
   * connector's desktop path scans (`DesktopDeviceManager` registers a
   * `MacDevice` whose `getHost()` is `127.0.0.1`, and `ClientAdapter`
   * opens a plain TCP socket to it). Simulators and emulators are the
   * common case for a dev server, so this defaults to on.
   */
  enableAndroid?: boolean;
  enableIOS?: boolean;
  enableHarmony?: boolean;
  enableDesktop?: boolean;
  /** Injection seam for tests. Defaults to lazily requiring the real connector. */
  createConnector?: (options: unknown) => ConnectorLike;
  logger?: LynxTransportLogger;
};

/** How often to re-request a client's session list as a fallback to its unprompted pushes. */
const SESSION_LIST_REFRESH_INTERVAL_MS = 5_000;
/** `connectDevices` timeout: long enough to catch an already-plugged-in device, short enough not to block startup. */
const DEVICE_DISCOVERY_TIMEOUT_MS = 3_000;

const noopLogger: LynxTransportLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

const mapClientToLynxClient = (client: ClientLike): LynxClient => {
  const { query } = client.info;
  return {
    clientId: client.clientId(),
    deviceId: query.device_id,
    appName: query.app,
    deviceName: query.device || query.device_model,
    os: query.os,
    sdkVersion: query.sdk_version ?? '0.0.0',
  };
};

const sessionListsEqual = (a: LynxSession[], b: LynxSession[]): boolean => {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  // Session lists are pushed as a full snapshot on every change, so a
  // positional comparison is enough — no need to sort or key by id.
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.sessionId !== y.sessionId || x.url !== y.url || x.type !== y.type) {
      return false;
    }
  }
  return true;
};

type ClientEntry = {
  client: ClientLike;
  info: LynxClient;
  sessions: LynxSession[];
};

export const createLynxTransport = async (
  options: LynxTransportOptions = {},
): Promise<LynxTransport> => {
  const logger = options.logger ?? noopLogger;
  const createConnector = options.createConnector ?? createRealConnector;
  const connector = createConnector({
    enableAndroid: options.enableAndroid ?? true,
    enableIOS: options.enableIOS ?? true,
    enableHarmony: options.enableHarmony ?? false,
    enableDesktop: options.enableDesktop ?? true,
  });

  const clients = new Map<number, ClientEntry>();
  const frameListeners = new Set<(frame: DeviceFrame) => void>();
  const topologyListeners = new Set<() => void>();
  let disposed = false;

  const emitTopologyChanged = (): void => {
    for (const listener of topologyListeners) {
      try {
        listener();
      } catch (error) {
        logger.error(`[lynx-dev] onTopologyChanged listener threw: ${String(error)}`);
      }
    }
  };

  const emitFrame = (frame: DeviceFrame): void => {
    for (const listener of frameListeners) {
      try {
        listener(frame);
      } catch (error) {
        logger.error(`[lynx-dev] onDeviceFrame listener threw: ${String(error)}`);
      }
    }
  };

  const requestSessionList = (entry: ClientEntry): void => {
    try {
      entry.client.sendMessage(buildListSessionEnvelope(entry.info.clientId));
    } catch (error) {
      logger.warn(
        `[lynx-dev] Failed to request session list for client ${entry.info.clientId}: ${String(error)}`,
      );
    }
  };

  const onClientConnected = (client: ClientLike): void => {
    const info = mapClientToLynxClient(client);
    const entry: ClientEntry = { client, info, sessions: [] };
    clients.set(info.clientId, entry);
    logger.info(
      `[lynx-dev] Lynx client connected: ${info.appName} on ${info.deviceName} (id ${info.clientId})`,
    );
    requestSessionList(entry);
    emitTopologyChanged();
  };

  const onClientDisconnected = (clientId: number): void => {
    if (!clients.delete(clientId)) {
      return;
    }
    logger.info(`[lynx-dev] Lynx client disconnected: ${clientId}`);
    emitTopologyChanged();
  };

  const onUsbClientMessage = (payload: { id: number; message: string }): void => {
    let parsed: ReturnType<typeof parseInboundMessage>;
    try {
      parsed = parseInboundMessage(payload.message);
    } catch (error) {
      logger.warn(`[lynx-dev] Failed to parse message from client ${payload.id}: ${String(error)}`);
      return;
    }
    if (!parsed) {
      return;
    }

    // `payload.id` — the id the connector assigned this client — is the
    // authoritative one; the envelope's own `client_id`/`sender` describe
    // the device's room membership, which does not exist over USB.
    const clientId = payload.id;

    if (parsed.kind === 'session-list') {
      const entry = clients.get(clientId);
      if (!entry || sessionListsEqual(entry.sessions, parsed.sessions)) {
        return;
      }
      entry.sessions = parsed.sessions;
      emitTopologyChanged();
      return;
    }

    if (parsed.kind === 'cdp') {
      emitFrame({
        kind: 'cdp',
        clientId,
        sessionId: parsed.sessionId,
        message: parsed.message,
      });
      return;
    }

    emitFrame({
      kind: 'customized',
      clientId,
      sessionId: parsed.sessionId,
      type: parsed.type,
      data: parsed.data,
    });
  };

  connector.on('client-connected', onClientConnected);
  connector.on('client-disconnected', onClientDisconnected);
  connector.on('usb-client-message', onUsbClientMessage);

  // An unplugged phone is the normal state at startup: discovery failures
  // are logged, never thrown, so they cannot take the dev server down.
  try {
    await connector.connectDevices(DEVICE_DISCOVERY_TIMEOUT_MS, options.deviceSerial ?? null, true);
  } catch (error) {
    logger.warn(`[lynx-dev] Lynx device discovery failed (will keep watching): ${String(error)}`);
  }
  try {
    connector.startWatchAllClients();
  } catch (error) {
    logger.warn(`[lynx-dev] Failed to start watching Lynx clients: ${String(error)}`);
  }

  const refreshTimer: ReturnType<typeof setInterval> = setInterval(() => {
    for (const entry of clients.values()) {
      requestSessionList(entry);
    }
  }, SESSION_LIST_REFRESH_INTERVAL_MS);
  // Never keep a host process alive solely for this polling fallback.
  refreshTimer.unref?.();

  return {
    listClients: () => Array.from(clients.values(), (entry) => entry.info),
    listSessions: (clientId: number) => clients.get(clientId)?.sessions ?? [],

    sendCdpMessage: (clientId: number, sessionId: number, message: unknown) => {
      const entry = clients.get(clientId);
      if (!entry) {
        logger.warn(`[lynx-dev] sendCdpMessage: unknown client ${clientId}`);
        return;
      }
      try {
        entry.client.sendMessage(buildCdpEnvelope(sessionId, message));
      } catch (error) {
        logger.warn(`[lynx-dev] sendCdpMessage failed for client ${clientId}: ${String(error)}`);
      }
    },

    onDeviceFrame: (listener) => {
      frameListeners.add(listener);
      return () => frameListeners.delete(listener);
    },

    onTopologyChanged: (listener) => {
      topologyListeners.add(listener);
      return () => topologyListeners.delete(listener);
    },

    dispose: async () => {
      if (disposed) {
        return;
      }
      disposed = true;

      clearInterval(refreshTimer);
      connector.off('client-connected', onClientConnected);
      connector.off('client-disconnected', onClientDisconnected);
      connector.off('usb-client-message', onUsbClientMessage);
      frameListeners.clear();
      topologyListeners.clear();

      for (const entry of clients.values()) {
        try {
          entry.client.close();
        } catch (error) {
          logger.warn(`[lynx-dev] Failed to close client ${entry.info.clientId}: ${String(error)}`);
        }
      }
      clients.clear();

      try {
        await connector.close();
      } catch (error) {
        logger.warn(`[lynx-dev] connector.close() failed: ${String(error)}`);
      }
    },
  };
};
