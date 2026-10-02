import type { AgentResponseEnvelope, GetAgentTargetsResponse, MetroTarget } from './index.js';

/**
 * Outcome of interpreting one `GET /rozenite/agent/targets` response. Callers
 * keep their own transport and wording; this only classifies the response.
 *
 * - `targets`: a success envelope carrying a targets array.
 * - `error-envelope`: the server answered with `ok: false`. `message` is the
 *   envelope's own message when it is a string, otherwise `undefined`.
 * - `unexpected`: the body was not a usable envelope (non-JSON, another
 *   shape, or a success envelope without a targets array). `httpOk` says
 *   whether the HTTP status was 2xx, so a caller can word the failure.
 */
export type ParsedTargetsResponse =
  | { kind: 'targets'; targets: MetroTarget[] }
  | { kind: 'error-envelope'; message: string | undefined }
  | { kind: 'unexpected'; httpOk: boolean };

/**
 * The middleware's `sendError` always pairs `ok:false` with an HTTP 400 or
 * 404, so the body has to be inspected before the status is allowed to decide
 * anything -- otherwise a real error envelope's own message is discarded in
 * favour of a bare status. The status only gets the final word when the body
 * turns out not to be a usable envelope at all.
 *
 * @param status HTTP status code of the response.
 * @param body The parsed JSON body, or `undefined` if it was not valid JSON.
 */
export const parseAgentTargetsResponse = (status: number, body: unknown): ParsedTargetsResponse => {
  const httpOk = status >= 200 && status < 300;

  if (typeof body !== 'object' || body === null || !('ok' in body)) {
    return { kind: 'unexpected', httpOk };
  }

  const envelope = body as AgentResponseEnvelope<GetAgentTargetsResponse>;

  if (!envelope.ok) {
    return {
      kind: 'error-envelope',
      message: typeof envelope.error?.message === 'string' ? envelope.error.message : undefined,
    };
  }

  if (!Array.isArray(envelope.result?.targets)) {
    return { kind: 'unexpected', httpOk };
  }

  return { kind: 'targets', targets: envelope.result.targets };
};
