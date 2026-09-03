/**
 * Re-resolves a device's debugger target through `@rozenite/middleware`'s
 * `GET /rozenite/agent/targets`, for use after a recoverable disconnect
 * (the page id in the original target can change underneath a live
 * connection). This is the only way Rozenite code discovers targets — see
 * `docs/adr/0000-single-target-discovery-endpoint.md` — so this module
 * does not parse `/json/list` itself; the middleware already applies the
 * selection rules (`packages/middleware/src/agent/metro-discovery.ts`) and
 * returns targets in preference order.
 */
import {
  AGENT_TARGETS_ROUTE,
  type AgentResponseEnvelope,
  type GetAgentTargetsResponse,
} from '@rozenite/agent-shared';

export class MetroUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetroUnreachableError';
  }
}

export type ResolvedMetroTarget = {
  webSocketDebuggerUrl: string;
  /** Human-readable device name, for display; falls back to `deviceId`. */
  name: string;
};

export const resolveMetroTarget = async (
  deviceId: string,
  preferredPageId?: string | null,
): Promise<ResolvedMetroTarget> => {
  const url = `${window.location.origin}${AGENT_TARGETS_ROUTE}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new MetroUnreachableError(
      `Unable to reach ${url}. Make sure the dev server is still running.`,
    );
  }

  // The middleware's `sendError` always pairs `ok:false` with an HTTP 400
  // or 404 (`packages/middleware/src/agent/routes.ts`), so the body has to
  // be parsed before the status is allowed to decide anything -- otherwise
  // a real error envelope's own message (e.g. "No connected device is
  // available") is discarded in favour of a bare "responded with status
  // 400". The status only gets the final word when the body turns out not
  // to be a usable envelope at all (a non-JSON body, or JSON of some other
  // shape -- an older middleware, or `/rozenite` not mounted here).
  const unexpectedResponseError = (): MetroUnreachableError =>
    new MetroUnreachableError(
      response.ok
        ? `${url} returned an unexpected response.`
        : `${url} responded with status ${response.status}.`,
    );

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw unexpectedResponseError();
  }

  if (typeof raw !== 'object' || raw === null || !('ok' in raw)) {
    throw unexpectedResponseError();
  }

  const body = raw as AgentResponseEnvelope<GetAgentTargetsResponse>;

  if (!body.ok) {
    const message =
      typeof body.error?.message === 'string' ? body.error.message : `${url} reported an error.`;
    throw new MetroUnreachableError(message);
  }

  if (!Array.isArray(body.result?.targets)) {
    throw unexpectedResponseError();
  }

  const matching = body.result.targets.filter((target) => target.deviceId === deviceId);
  if (matching.length === 0) {
    throw new Error(`No target is currently available for device "${deviceId}".`);
  }

  // Go back to the page that was actually being debugged, if it is still
  // there: prefer the target whose `pageId` matches the page id we started
  // from, and otherwise fall back to the first target, which the endpoint
  // already returns in preference order (Fusebox first, then lowest id). A
  // device can host several pages -- every Lynx card is one -- so without
  // this a reconnect silently lands on a different page than the one the
  // user opened. In LynxExplorer that page is its own home screen, which
  // has no Rozenite in it, so the reconnect surfaced as a permanent
  // "Rozenite isn't set up in this app" that reloading could not clear.
  const preferred =
    preferredPageId != null
      ? matching.find((target) => target.pageId === preferredPageId)
      : undefined;

  const selected = preferred ?? matching[0];

  return {
    webSocketDebuggerUrl: selected.webSocketDebuggerUrl,
    name: selected.name || deviceId,
  };
};
