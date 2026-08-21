/**
 * The protocol translation layer: pure functions that decide what should
 * happen to one frame, with no I/O of their own. See the module doc
 * comment in `../types.ts` for how this fits into the rest of the
 * package.
 */
export type { BridgeCloseCause } from './close-reasons.js';
export {
  CONNECTION_LOST_CLOSE_REASON,
  NEW_DEBUGGER_OPENED_CLOSE_REASON,
  PAGE_NOT_FOUND_CLOSE_REASON,
  RECREATING_DEVICE_CLOSE_REASON,
  getCloseReason,
} from './close-reasons.js';
export type { CdpResponse, DeviceAction, HostAction } from './types.js';
export { translateDeviceFrame } from './translate-device-frame.js';
export { translateHostMessage } from './translate-host-message.js';
