/**
 * The seam between the two halves of this package.
 *
 * `src/transport/` owns `@lynx-js/debug-router-connector` and speaks
 * DebugRouter: rooms, USB clients, `Customized` envelopes. `src/bridge/`
 * owns the protocol translation and speaks Fusebox CDP, the dialect
 * `@rozenite/app` already knows. Neither imports the other; both import
 * this file, which is deliberately free of both vocabularies where they
 * disagree.
 */

/** A connected Lynx application (DebugRouter calls this a "client"). */
export type LynxClient = {
  /** DebugRouter's `client_id`. Surfaces to Rozenite as a device id. */
  clientId: number;
  /** Physical device serial/udid the client was discovered on. */
  deviceId: string;
  /** Application identifier reported at registration. */
  appName: string;
  /** Human-readable device name, e.g. "Pixel 7". */
  deviceName: string;
  /** `Android` | `iOS` | `Harmony` | `Mac` | ... */
  os: string;
  /** LynxSDK version reported at registration. */
  sdkVersion: string;
};

/** A LynxView inside a client. DebugRouter and the Lynx docs call it a "card". */
export type LynxSession = {
  /** DebugRouter's `session_id`. `-1` addresses the client globally. */
  sessionId: number;
  /** Template URL the card was opened with. */
  url: string;
  /** Card type reported by the SDK, e.g. `web` or an empty string. */
  type: string;
};

/**
 * A frame that arrived from a device, already unwrapped from its
 * DebugRouter envelope. The bridge decides what — if anything — the host
 * should see.
 */
export type DeviceFrame =
  /** A CDP message: either a response (`id`) or an event (`method`). */
  | { kind: 'cdp'; clientId: number; sessionId: number; message: unknown }
  /**
   * A `Customized` message of some non-CDP type. This is how
   * `lynx.getDevtool().dispatchEvent({ type, data })` surfaces on the wire,
   * and therefore how `@rozenite/lynx` pushes plugin messages to the host.
   */
  | { kind: 'customized'; clientId: number; sessionId: number; type: string; data: unknown };

/**
 * Everything the bridge and the HTTP/WS routes need from DebugRouter.
 * Narrow on purpose: it is the whole surface a fake has to implement in a
 * unit test.
 */
export type LynxTransport = {
  /** Clients currently connected, in discovery order. */
  listClients: () => LynxClient[];
  /** Last known cards for a client. Empty until the app reports a session list. */
  listSessions: (clientId: number) => LynxSession[];
  /** Sends one CDP message to a card, verbatim, wrapped for DebugRouter. */
  sendCdpMessage: (clientId: number, sessionId: number, message: unknown) => void;
  /** Subscribes to device -> host frames. Returns an unsubscribe function. */
  onDeviceFrame: (listener: (frame: DeviceFrame) => void) => () => void;
  /**
   * Fires when the set of clients or their cards changes, so `/json/list`
   * consumers and open sockets can react. Returns an unsubscribe function.
   */
  onTopologyChanged: (listener: () => void) => () => void;
  dispose: () => Promise<void>;
};
