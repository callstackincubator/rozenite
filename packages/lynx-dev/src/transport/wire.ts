/**
 * Pure helpers for the DebugRouter `Customized` wire envelope. No I/O, no
 * connector types — kept trivially unit-testable and reused by
 * `transport/index.ts` for both directions of traffic.
 *
 * Outbound envelopes are objects the caller writes via `client.sendMessage`.
 * Inbound envelopes arrive as the raw JSON string DebugRouter hands to the
 * `usb-client-message` event; `parseInboundMessage` is the only place that
 * parses them.
 */
import type { LynxSession } from '../types.js';

/** Builds the outbound `Customized{type:"CDP"}` envelope for `client.sendMessage`. */
export const buildCdpEnvelope = (sessionId: number, message: unknown) => ({
  event: 'Customized' as const,
  data: {
    type: 'CDP' as const,
    data: {
      // Addresses the client this socket already belongs to; DebugRouter's
      // own desktop client sends this literal value too.
      client_id: -1,
      session_id: sessionId,
      message,
    },
    sender: 0,
  },
});

/** Builds the outbound `Customized{type:"ListSession"}` envelope. */
export const buildListSessionEnvelope = (clientId: number) => ({
  event: 'Customized' as const,
  data: {
    type: 'ListSession' as const,
    data: {
      client_id: clientId,
    },
    sender: 0,
  },
});

/**
 * Deliberately carries no client id. The `client_id` and `sender` fields
 * inside a DebugRouter envelope are the *device's* view of the room and are
 * meaningless over a direct USB connection (the app has no room membership
 * to report, and `sendCustomizedMessage` sends a literal `-1` in the other
 * direction). The authoritative id is the one the connector assigns when it
 * registers the client, which arrives alongside the payload on the
 * `usb-client-message` event — see `transport/index.ts`, which attaches it.
 */
export type ParsedInboundMessage =
  | { kind: 'cdp'; sessionId: number; message: unknown }
  | { kind: 'customized'; sessionId: number; type: string; data: unknown }
  | { kind: 'session-list'; sessions: LynxSession[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Parses one `usb-client-message` payload string into a typed frame, or
 * `null` when the envelope is malformed, not JSON, or a `Customized` type
 * this package has no use for (e.g. driver-internal types whose payload
 * shape does not match what we expect). Never throws.
 */
export const parseInboundMessage = (raw: string): ParsedInboundMessage | null => {
  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(envelope) || envelope['event'] !== 'Customized') {
    return null;
  }

  const inner = envelope['data'];
  if (!isRecord(inner) || typeof inner['type'] !== 'string') {
    return null;
  }

  const type = inner['type'];

  if (type === 'SessionList') {
    const rawSessions = inner['data'];
    if (!Array.isArray(rawSessions)) {
      return null;
    }

    const sessions: LynxSession[] = rawSessions.filter(isRecord).map((session) => ({
      sessionId: typeof session['session_id'] === 'number' ? session['session_id'] : -1,
      url: typeof session['url'] === 'string' ? session['url'] : '',
      type: typeof session['type'] === 'string' ? session['type'] : '',
    }));

    return { kind: 'session-list', sessions };
  }

  // Both plain CDP frames and our own `Customized{type:"rozenite"}` frames
  // (and, structurally, anything else pushed the same way) share this
  // `{client_id, session_id, message}` payload shape.
  const payload = inner['data'];
  if (!isRecord(payload) || typeof payload['session_id'] !== 'number') {
    return null;
  }

  const sessionId = payload['session_id'];

  if (type === 'CDP') {
    const rawMessage = payload['message'];
    let message: unknown;
    if (typeof rawMessage === 'string') {
      try {
        message = JSON.parse(rawMessage);
      } catch {
        return null;
      }
    } else {
      message = rawMessage;
    }
    return { kind: 'cdp', sessionId, message };
  }

  return { kind: 'customized', sessionId, type, data: payload['message'] };
};
