/**
 * The Fusebox WebSocket close reasons that
 * `packages/app/src/connection/device-connection.ts`'s `handleClose`
 * keys its recovery behaviour off of. `handleClose` matches with
 * `reason.includes(...)`, not exact equality, so these bracketed tokens
 * just need to appear somewhere in the close reason string the bridge
 * sends — see `getCloseReason` below for the one place that should
 * produce them.
 */

/**
 * The device is being torn down and recreated (e.g. an app reload made
 * DebugRouter register a fresh client for what the host still thinks is
 * the same device). Recoverable: `handleClose` calls `runConnectLoop`,
 * which re-resolves the target through `/json/list` (`resolveMetroTarget`)
 * and retries, up to `RECOVERY_MAX_ATTEMPTS`.
 */
export const RECREATING_DEVICE_CLOSE_REASON = '[RECREATING_DEVICE]';

/**
 * The session (LynxView/"card") the host connected to no longer exists on
 * the device — e.g. it was closed. Recoverable, exactly like
 * `RECREATING_DEVICE_CLOSE_REASON` above.
 */
export const PAGE_NOT_FOUND_CLOSE_REASON = '[PAGE_NOT_FOUND]';

/**
 * The underlying transport to the device dropped (the DebugRouter client
 * disconnected, its socket died, etc). Recoverable, exactly like
 * `RECREATING_DEVICE_CLOSE_REASON` above.
 */
export const CONNECTION_LOST_CLOSE_REASON = '[CONNECTION_LOST]';

/**
 * Another debugger (React Native DevTools, another Rozenite window) has
 * already taken the device. Terminal, not recoverable: `handleClose` sets
 * `disconnected` and does not retry — the bridge cannot tell what the
 * other debugger is doing, and fighting it for the device isn't its call
 * to make by reconnecting.
 */
export const NEW_DEBUGGER_OPENED_CLOSE_REASON = '[NEW_DEBUGGER_OPENED]';

/**
 * Bridge-level reasons a device-facing WebSocket the bridge owns can
 * close, independent of the Fusebox vocabulary above. `src/server/` picks
 * one of these when it tears a host socket down; `getCloseReason` is the
 * one place that maps it to the string the host's recovery machinery
 * actually understands.
 */
export type BridgeCloseCause =
  /** The `LynxClient` (the whole app) disconnected from DebugRouter —
   * e.g. the app process was killed, or reloaded and re-registered as a
   * new client. Maps to `RECREATING_DEVICE_CLOSE_REASON`: from the host's
   * point of view this looks like the device coming back as a fresh
   * registration, which is exactly what that reason means to it. */
  | 'client-disconnected'
  /** The `LynxSession` (card) this host socket was talking to is gone —
   * e.g. the LynxView was closed while still open in the host. Maps to
   * `PAGE_NOT_FOUND_CLOSE_REASON`. */
  | 'session-gone'
  /** The DebugRouter transport itself dropped (room/socket connectivity
   * lost), independent of any single client or session. Maps to
   * `CONNECTION_LOST_CLOSE_REASON`. */
  | 'transport-lost'
  /** A newer host connection (or another debugger entirely) has taken
   * over this device/session, and this socket is being closed in favour
   * of it. Maps to `NEW_DEBUGGER_OPENED_CLOSE_REASON`. */
  | 'superseded';

/**
 * Maps a bridge-level close cause to the Fusebox close reason string
 * `device-connection.ts`'s `handleClose` expects. Kept as one function so
 * `src/server/` has a single place to call instead of hardcoding these
 * bracketed strings at every socket-close site.
 */
export const getCloseReason = (cause: BridgeCloseCause): string => {
  switch (cause) {
    case 'client-disconnected':
      return RECREATING_DEVICE_CLOSE_REASON;
    case 'session-gone':
      return PAGE_NOT_FOUND_CLOSE_REASON;
    case 'transport-lost':
      return CONNECTION_LOST_CLOSE_REASON;
    case 'superseded':
      return NEW_DEBUGGER_OPENED_CLOSE_REASON;
  }
};
