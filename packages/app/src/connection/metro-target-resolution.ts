/**
 * Re-resolves a device's debugger target through Metro's `/json/list`, for
 * use after a recoverable disconnect (the page id in the original target
 * can change underneath a live connection — see
 * `packages/middleware/src/agent/metro-discovery.ts`, which this mirrors
 * the selection rules of for the Node/agent side of the same problem).
 */

type JsonPageDescription = {
  id: string;
  deviceName?: string;
  webSocketDebuggerUrl: string;
  reactNative?: {
    logicalDeviceId?: string;
    capabilities?: {
      prefersFuseboxFrontend?: boolean;
    };
  };
};

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

// Mirrors metro-discovery.ts's `sortPages`: prefer the page that advertises
// the modern Fusebox frontend, then break ties by id so selection is
// deterministic.
const sortPages = (pages: JsonPageDescription[]): JsonPageDescription[] => {
  return [...pages].sort((a, b) => {
    const scoreA = a.reactNative?.capabilities?.prefersFuseboxFrontend ? 1 : 0;
    const scoreB = b.reactNative?.capabilities?.prefersFuseboxFrontend ? 1 : 0;
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    return a.id.localeCompare(b.id);
  });
};

export const resolveMetroTarget = async (deviceId: string): Promise<ResolvedMetroTarget> => {
  let response: Response;
  try {
    response = await fetch(`${window.location.origin}/json/list`);
  } catch {
    throw new MetroUnreachableError(
      `Unable to reach Metro at ${window.location.origin}. Make sure it is still running.`,
    );
  }

  if (!response.ok) {
    throw new MetroUnreachableError(`Metro responded with status ${response.status}.`);
  }

  let pages: JsonPageDescription[];
  try {
    pages = (await response.json()) as JsonPageDescription[];
  } catch {
    throw new MetroUnreachableError('Metro returned an unexpected response for /json/list.');
  }

  const matching = pages.filter((page) => page.reactNative?.logicalDeviceId === deviceId);
  if (matching.length === 0) {
    throw new Error(`No Metro target is currently available for device "${deviceId}".`);
  }

  const [selected] = sortPages(matching);

  return {
    webSocketDebuggerUrl: selected.webSocketDebuggerUrl,
    name: selected.deviceName || deviceId,
  };
};
