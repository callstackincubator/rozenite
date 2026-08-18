import type { MetroTarget } from '@rozenite/agent-shared';

/**
 * Mirrors the shape (and selection rules) of
 * `packages/middleware/src/agent/metro-discovery.ts`, but implemented with
 * the global `fetch` instead of `node:http` so the CLI doesn't need to pull
 * in Express/`ws` transitively through `@rozenite/middleware`.
 */
type JsonPageDescription = {
  id: string;
  title: string;
  description: string;
  appId: string;
  deviceName: string;
  webSocketDebuggerUrl: string;
  reactNative?: {
    logicalDeviceId?: string;
    capabilities?: {
      prefersFuseboxFrontend?: boolean;
    };
  };
};

const getErrorDetails = (error: unknown): string | null => {
  if (!error) {
    return null;
  }

  if (error instanceof AggregateError && error.errors.length > 0) {
    return error.errors
      .map((entry) => (entry instanceof Error ? entry.message : String(entry)))
      .join('; ');
  }

  return error instanceof Error ? error.message : String(error);
};

const fetchJsonList = async (host: string, port: number): Promise<JsonPageDescription[]> => {
  const url = `http://${host}:${port}/json/list`;
  const unreachableMessage = (details: string | null): string =>
    `Unable to reach Metro at ${url}. Make sure Metro is running and reachable, then try again.${
      details ? ` Details: ${details}` : ''
    }`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(unreachableMessage(getErrorDetails(error)));
  }

  if (!response.ok) {
    throw new Error(unreachableMessage(`Metro responded with status ${response.status}`));
  }

  try {
    return (await response.json()) as JsonPageDescription[];
  } catch (error) {
    throw new Error(unreachableMessage(getErrorDetails(error)));
  }
};

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

export const getMetroTargets = async (host: string, port: number): Promise<MetroTarget[]> => {
  const pages = await fetchJsonList(host, port);
  const byDevice = new Map<string, JsonPageDescription[]>();

  for (const page of pages) {
    const deviceId = page.reactNative?.logicalDeviceId;
    if (!deviceId) {
      continue;
    }

    const existing = byDevice.get(deviceId) || [];
    existing.push(page);
    byDevice.set(deviceId, existing);
  }

  return Array.from(byDevice.entries())
    .map(([deviceId, devicePages]) => {
      const selectedPage = sortPages(devicePages)[0];
      return {
        id: deviceId,
        name: selectedPage.deviceName || deviceId,
        appId: selectedPage.appId,
        pageId: selectedPage.id,
        title: selectedPage.title,
        description: selectedPage.description,
        webSocketDebuggerUrl: selectedPage.webSocketDebuggerUrl,
      } satisfies MetroTarget;
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
};
