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
   * is how you lose the *iOS Simulator* specifically. An iOS Simulator is
   * an ordinary macOS process, so DebugRouter inside it is reachable on
   * `127.0.0.1:8901-8919` — which is exactly what the connector's desktop
   * path scans (`DesktopDeviceManager` registers a `MacDevice` whose
   * `getHost()` is `127.0.0.1`, and `ClientAdapter` opens a plain TCP
   * socket to it). Simulators are the common case for a dev server, so
   * this defaults to on.
   *
   * An Android *emulator* is not on that path: adb lists it exactly like a
   * physical device, so `enableAndroid` finds it and reports its real
   * `emulator-5554`-style serial. Measured by running the connector with
   * one platform enabled at a time against a booted iPhone Simulator and a
   * booted Android emulator: `enableAndroid` alone found
   * `Android/emulator-5554`, `enableDesktop` alone found `Mac/Mac:8901`.
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
/**
 * How often device discovery is retried after the one at startup.
 *
 * `connectDevices` enumerates whatever is attached *right now* and then
 * stops; the connector only watches clients on devices it already knows.
 * Anything missed in that one window is therefore invisible until the dev
 * server is restarted -- and the window is easy to miss, because it is
 * capped at `DEVICE_DISCOVERY_TIMEOUT_MS` and enumeration slows down with
 * every attached device. Observed with three attached (a phone and two
 * emulators): the phone was never discovered, `/json/list` stayed empty
 * with no error logged, while a connector started seconds later found it
 * immediately.
 *
 * Retrying on a timer also covers the ordinary case of plugging a device
 * in, or booting an emulator, after the dev server is already running.
 * Slower than the session-list refresh because enumerating devices costs
 * more than asking a known client for its cards.
 */
const DEVICE_DISCOVERY_RETRY_INTERVAL_MS = 15_000;

const noopLogger: LynxTransportLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/** First non-empty string, or `undefined` if there isn't one. */
const firstNonEmpty = (...values: Array<string | undefined>): string | undefined =>
  values.find((value) => typeof value === 'string' && value.length > 0);

/**
 * Maps a connector client onto this package's vocabulary, preferring the
 * device's own `raw_info` over the connector's flat `query` fields
 * wherever the two describe the same thing.
 *
 * The flat fields describe *the transport that found the client*, not the
 * client -- see `ClientQueryLike`'s doc comment. On the desktop path (the
 * iOS Simulator) `query.os`, `query.device` and `query.device_id` are all
 * the host machine, so a simulator-hosted iOS app reports as `Mac (Mac)`.
 * `raw_info` is the device's own registration payload and says `iOS` /
 * `iPhone` / `26.4.1`.
 *
 * The adb path (Android, emulators included) does not have this problem:
 * `query.os` is already `Android` and `query.device_id` the real serial.
 * Android's `raw_info` carries no `osType`, so `os` falls back to
 * `query.os` there -- which is why the fallback order matters.
 *
 * `deviceId` keeps `query.device_id` as its base: on a physical device
 * that is the real udid/serial, and `raw_info` carries no equivalent
 * (`debugRouterId` is per-app-process, not per-device -- see its doc
 * comment). To keep two simulators on one machine from collapsing onto a
 * single `deviceId` of `"Mac"`, the connector's TCP port is appended when
 * it is the only thing telling them apart: `DesktopDeviceManager` scans
 * `127.0.0.1:8901-8919` and each running simulator owns one
 * port, which -- unlike `debugRouterId` or the connector's own numeric
 * client id -- is stable across app relaunches (verified across four
 * successive relaunches on one simulator: port `8901` throughout, while
 * the client id went 2, 3, 4, 5).
 */
const mapClientToLynxClient = (client: ClientLike): LynxClient => {
  const { query, port } = client.info;
  const rawInfo = query.raw_info ?? {};

  const os = firstNonEmpty(rawInfo.osType, query.os) ?? 'unknown';
  const isHostReportedAsDevice = os !== query.os;

  return {
    clientId: client.clientId(),
    // Disambiguate only when the connector reported the *host* rather than
    // the device (the desktop/simulator path); on a physical device
    // `query.device_id` is already a real, unique serial and is left alone
    // so a saved DevTools URL stays valid.
    deviceId: isHostReportedAsDevice ? `${query.device_id}:${port}` : query.device_id,
    appName: firstNonEmpty(rawInfo.App, query.app) ?? 'unknown',
    // `raw_info.deviceModel` first (the device's own answer), then the
    // connector's original `device || device_model` order, unchanged, so
    // a physical device with no `raw_info` reports exactly as before.
    deviceName: firstNonEmpty(rawInfo.deviceModel, query.device, query.device_model) ?? 'unknown',
    os,
    osVersion: rawInfo.osVersion,
    sdkVersion: firstNonEmpty(rawInfo.sdkVersion, query.sdk_version) ?? '0.0.0',
    bundleId: rawInfo.bundleId,
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
    const existing = clients.get(info.clientId);

    // A client already known is one the periodic re-discovery sweep has
    // re-reported, not a new one. Keep the cards already recorded for it:
    // starting from `sessions: []` again would blank its targets out of
    // `/json/list` until the next session list came back, making them
    // blink on every sweep. Nothing is logged either, since nothing
    // connected.
    if (existing) {
      existing.client = client;
      existing.info = info;
      requestSessionList(existing);
      return;
    }

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
  const discoverDevices = async (): Promise<void> => {
    try {
      await connector.connectDevices(
        DEVICE_DISCOVERY_TIMEOUT_MS,
        options.deviceSerial ?? null,
        true,
      );
    } catch (error) {
      logger.warn(`[lynx-dev] Lynx device discovery failed (will keep watching): ${String(error)}`);
    }

    try {
      connector.startWatchAllClients();
    } catch (error) {
      logger.warn(`[lynx-dev] Failed to start watching Lynx clients: ${String(error)}`);
    }
  };

  await discoverDevices();

  // Devices already connected are re-reported by `connectDevices` as
  // clients that are already in `clients` -- `onClientConnected` keys on
  // `client.clientId()`, so a repeat is an in-place update, not a
  // duplicate target.
  const discoveryTimer: ReturnType<typeof setInterval> = setInterval(() => {
    if (disposed) {
      return;
    }

    void discoverDevices();
  }, DEVICE_DISCOVERY_RETRY_INTERVAL_MS);
  // Never keep a host process alive solely for this retry.
  discoveryTimer.unref?.();

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
      clearInterval(discoveryTimer);
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
