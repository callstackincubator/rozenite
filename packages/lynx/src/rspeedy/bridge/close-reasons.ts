import {
  CONNECTION_LOST_CLOSE_REASON,
  NEW_DEBUGGER_OPENED_CLOSE_REASON,
  PAGE_NOT_FOUND_CLOSE_REASON,
  RECREATING_DEVICE_CLOSE_REASON,
} from '@rozenite/tools/protocol';

// The reason strings are defined once, in `@rozenite/tools/protocol`, next to
// the classification the hosts apply to them. Re-exported so the bridge's
// public surface is unchanged.
export {
  CONNECTION_LOST_CLOSE_REASON,
  NEW_DEBUGGER_OPENED_CLOSE_REASON,
  PAGE_NOT_FOUND_CLOSE_REASON,
  RECREATING_DEVICE_CLOSE_REASON,
};

// The Fusebox close reasons the hosts key their recovery behaviour off of
// (see `classifyCloseReason` in `@rozenite/tools/protocol`). The first three
// are recoverable: the host re-resolves the target and reconnects. The last
// is terminal: another debugger took the device, and the host must not fight
// it by reconnecting. Hosts match with `reason.includes(...)`, so the
// bracketed tokens only need to appear somewhere in the close reason string;
// `getCloseReason` below is the one place that should produce them.

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
