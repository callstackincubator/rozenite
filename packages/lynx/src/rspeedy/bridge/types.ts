/**
 * Result types for the protocol translation functions in this directory.
 * See `translate-host-message.ts` and `translate-device-frame.ts`.
 */

/** A CDP response frame: `{ id, result }`. What the bridge sends back to
 * the host directly, without ever reaching the device, when it answers a
 * command locally (see `translate-host-message.ts`). */
export type CdpResponse = {
  id: number;
  result: Record<string, unknown>;
};

/** What the bridge decided to do with one host -> device frame. */
export type HostAction =
  /**
   * Answer the host locally; do not forward to the device.
   *
   * `events` are unsolicited CDP events (`{ method, params }`, no `id`) to
   * send after the reply, in order. The bridge speaks for a domain the
   * device doesn't implement, so anything the host would normally learn
   * from that domain's events has to originate here — see
   * `ReactNativeApplication.enable` in `translate-host-message.ts`.
   */
  | { kind: 'reply'; message: CdpResponse; events?: unknown[] }
  /** Send to the device verbatim. */
  | { kind: 'forward'; message: unknown }
  /** Input was malformed or otherwise unusable; do nothing. */
  | { kind: 'drop'; reason: string };

/** What the bridge decided to do with one device -> host frame. */
export type DeviceAction =
  /** Send to the host. */
  | { kind: 'send'; message: unknown }
  /** Input was malformed, or this frame isn't meant for the host; do
   * nothing. */
  | { kind: 'drop'; reason: string };
