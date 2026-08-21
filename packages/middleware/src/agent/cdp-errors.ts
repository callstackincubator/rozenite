/**
 * Typed errors for the CDP command channel.
 *
 * A device that does not implement a method answers
 * `{ id, error: { code: -32601, message: "..." } }`. Rejecting with the
 * stringified error object — as this used to — throws away the one piece
 * of context an agent needs to act, which is *which method* the device
 * refused. These errors keep it.
 */

/** The JSON-RPC "method not found" code, which CDP reuses verbatim. */
export const CDP_METHOD_NOT_FOUND = -32601;

export class UnsupportedCdpMethodError extends Error {
  readonly method: string;

  constructor(method: string, detail?: string) {
    super(
      `The device does not implement "${method}"${detail ? ` (${detail})` : ''}. This ` +
        `target's runtime exposes a different CDP surface than React Native; run ` +
        '`rozenite agent domains` to see what this session supports.',
    );
    this.name = 'UnsupportedCdpMethodError';
    this.method = method;
  }
}

export class CdpCommandError extends Error {
  readonly method: string;

  constructor(method: string, detail: string) {
    super(`"${method}" failed: ${detail}`);
    this.name = 'CdpCommandError';
    this.method = method;
  }
}

/**
 * Thrown when a device accepts a command but never emits the event that
 * completes it. On a runtime whose domain merely *shares a name* with
 * Chrome's — Lynx's Perfetto-backed `Tracing`, for instance — the command
 * succeeds and the awaited event simply never comes, so without this the
 * call hangs forever.
 */
export class CdpEventTimeoutError extends Error {
  readonly cdpEvent: string;

  constructor(cdpEvent: string, timeoutMs: number, hint?: string) {
    super(
      `Timed out after ${timeoutMs}ms waiting for "${cdpEvent}" from the device.` +
        (hint ? ` ${hint}` : ''),
    );
    this.name = 'CdpEventTimeoutError';
    this.cdpEvent = cdpEvent;
  }
}

const getErrorDetail = (error: unknown): string => {
  if (error && typeof error === 'object' && !Array.isArray(error)) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return JSON.stringify(error);
};

const getErrorCode = (error: unknown): number | undefined => {
  if (error && typeof error === 'object' && !Array.isArray(error)) {
    const code = (error as Record<string, unknown>).code;
    return typeof code === 'number' ? code : undefined;
  }

  return undefined;
};

export const createCDPCommandError = (method: string, error: unknown): Error => {
  const detail = getErrorDetail(error);

  if (getErrorCode(error) === CDP_METHOD_NOT_FOUND) {
    return new UnsupportedCdpMethodError(method, detail);
  }

  return new CdpCommandError(method, detail);
};
