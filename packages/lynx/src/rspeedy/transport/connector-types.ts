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

/**
 * The device's own registration payload, forwarded verbatim by the
 * connector as `query.raw_info` (`usb/ClientAdapter.js`'s
 * `handleConnection`: `raw_info: result`, where `result` is the
 * `Register` message's `info` object straight off the wire).
 *
 * This is the only part of `ClientQueryLike` the *device* actually
 * authored, and it is therefore the authoritative source for what the app
 * and its host are -- see `ClientQueryLike` below for why the flat fields
 * are not. Every field is optional: `raw_info` is typed `any` by the
 * connector, an older LynxSDK may not send all of these, and a fake in a
 * unit test should not have to fill in fields it does not exercise.
 */
export type ClientRawInfoLike = {
  /** App name, e.g. `LynxExplorer`. Mirrored into `query.app`. */
  readonly App?: string;
  /** Application bundle/package id, e.g. `com.lynx.LynxExplorer`. */
  readonly bundleId?: string;
  /**
   * A UUID DebugRouter mints on the device.
   *
   * Deliberately NOT used as a device identity anywhere in this package.
   * Measured on LynxExplorer/iOS (DebugRouter 2.0.0): it is stable for the
   * lifetime of one app *process* -- two successive connections from the
   * same launch report the same value -- and a fresh UUID on every
   * relaunch. That is the identity of a run of the app, not of a device,
   * and it is exactly the lifetime `computeLogicalDeviceId`
   * (`../server/logical-device-id.ts`) must not depend on.
   */
  readonly debugRouterId?: string;
  readonly debugRouterVersion?: string;
  /** Real device model as the device reports it, e.g. `iPhone`, `Pixel 7`. */
  readonly deviceModel?: string;
  /** Real OS as the device reports it: `iOS`, `Android`, `Harmony`. */
  readonly osType?: string;
  /** e.g. `26.4.1`. */
  readonly osVersion?: string;
  /** LynxSDK version. Mirrored into `query.sdk_version`. */
  readonly sdkVersion?: string;
};

/**
 * The fields of `UsbClient.info.query` this package reads.
 *
 * Note which of these describe the *device* and which describe the
 * *transport that found it*. `os`, `device`, `device_id` and
 * `device_model` are assembled by the connector's device manager, not by
 * the app: `usb/ClientAdapter.js` sets `os: this.type`, `device:
 * this.device`, `device_id: this.device_id` from whichever manager owns
 * the connection. On the adb and usbmux paths those are the real
 * udid/serial (an Android emulator included -- adb lists it like any
 * other device), but an iOS *Simulator* is reached over the *desktop*
 * path (`DesktopDeviceManager` -> `MacDevice`), where all three become
 * the host machine -- literally `"Mac"` on macOS. The connector itself
 * knows this is lossy and patches around it in one place, appending
 * `_FromMac` to `device_model` when a `Mac` manager reports an `iPhone`.
 *
 * So: prefer `raw_info` for anything describing the app or its device,
 * and fall back to these only when `raw_info` is missing.
 */
export type ClientQueryLike = {
  readonly app: string;
  readonly os: string;
  readonly device: string;
  readonly device_model: string;
  readonly device_id: string;
  readonly sdk_version?: string;
  readonly raw_info?: ClientRawInfoLike;
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

/** The slice of a connector device this package calls. */
export type DeviceLike = {
  /** Starts (or restarts) the watcher that discovers this device's clients. */
  startWatchClient: () => void;
};

/** The events this package subscribes to on the connector. */
export type ConnectorEventMap = {
  'device-connected': DeviceLike;
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
