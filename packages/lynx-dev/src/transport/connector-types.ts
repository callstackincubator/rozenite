/**
 * Structural (not nominal) description of the slice of
 * `@lynx-js/debug-router-connector` that `transport/index.ts` relies on.
 *
 * These types intentionally do not import anything from the connector
 * package: they exist so tests can hand `createLynxTransport` an in-memory
 * fake without ever loading the real (CJS-only, dependency-heavy) module.
 * `transport/connector.ts` is the single place that bridges the real
 * `DebugRouterConnector` into this shape.
 */

/** The fields of `UsbClient.info.query` this package reads. */
export type ClientQueryLike = {
  readonly app: string;
  readonly os: string;
  readonly device: string;
  readonly device_model: string;
  readonly device_id: string;
  readonly sdk_version?: string;
};

/** The slice of DebugRouter's `UsbClient` this package calls. */
export type ClientLike = {
  clientId: () => number;
  readonly info: {
    readonly port: number;
    readonly id: number;
    readonly query: ClientQueryLike;
  };
  close: () => void;
  /** Fire-and-forget: writes `message` to the socket verbatim. */
  sendMessage: (message: unknown) => void;
};

/** The events this package subscribes to on the connector. */
export type ConnectorEventMap = {
  'client-connected': ClientLike;
  'client-disconnected': number;
  'usb-client-message': { id: number; message: string };
};

/** The slice of DebugRouter's `DebugRouterConnector` this package calls. */
export type ConnectorLike = {
  connectDevices: (
    timeout?: number,
    serial?: string | null,
    isAutoListenClients?: boolean,
  ) => Promise<unknown>;
  startWatchAllClients: (force?: boolean) => void;
  on: <Event extends keyof ConnectorEventMap>(
    event: Event,
    callback: (payload: ConnectorEventMap[Event]) => void,
  ) => void;
  off: <Event extends keyof ConnectorEventMap>(
    event: Event,
    callback: (payload: ConnectorEventMap[Event]) => void,
  ) => void;
  close: () => Promise<void>;
};
