import { request as httpRequest } from 'node:http';
import type { AgentTargetPlatform, MetroTarget } from '@rozenite/agent-shared';

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
  /**
   * Rozenite's own extension to Metro's page shape, served by dev servers
   * that front a non-React-Native runtime (`@rozenite/lynx-dev` sets it).
   * Metro itself never emits it, and every other consumer ignores unknown
   * keys, so this is additive.
   */
  rozenite?: {
    platform?: AgentTargetPlatform;
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

const requestJson = async <T>(host: string, port: number, pathname: string): Promise<T> => {
  const url = new URL(`http://${host}:${port}${pathname}`);

  return await new Promise<T>((resolve, reject) => {
    const req = httpRequest(url, { method: 'GET' }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if ((res.statusCode || 0) >= 400) {
          reject(new Error(`Metro responded with status ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data) as T);
        } catch (error) {
          reject(error);
        }
      });
    });
    req.once('error', reject);
    req.end();
  }).catch((error) => {
    const details = getErrorDetails(error);
    throw new Error(
      `Unable to reach Metro at http://${host}:${port}. Make sure Metro is running and reachable, then try again.${details ? ` Details: ${details}` : ''}`,
    );
  });
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

const prefersFusebox = (page: JsonPageDescription): boolean =>
  page.reactNative?.capabilities?.prefersFuseboxFrontend === true;

/**
 * The pages of one device that are worth offering, in order.
 *
 * Two different things can put several pages on one device, and they need
 * opposite treatment. Metro serves a modern Fusebox page *and* a legacy
 * page for the same runtime -- those are one target described twice, so
 * the legacy one is dropped. But a device can also host genuinely
 * separate runtimes, each with its own page: every Lynx card is one, and
 * so is a React Native app's extra VM (a Reanimated worklet runtime, for
 * instance). Those are not duplicates and must all survive, or they are
 * simply unreachable -- which is what used to happen, since only
 * `sortPages(...)[0]` was ever returned. In LynxExplorer that meant the
 * lowest page id won every time, and the lowest page id is LynxExplorer's
 * own home screen, so a developer's card could not be opened at all.
 */
const selectDevicePages = (pages: JsonPageDescription[]): JsonPageDescription[] => {
  const fuseboxPages = pages.filter(prefersFusebox);

  return sortPages(fuseboxPages.length > 0 ? fuseboxPages : pages);
};

export const getMetroTargets = async (host: string, port: number): Promise<MetroTarget[]> => {
  const pages = await requestJson<JsonPageDescription[]>(host, port, '/json/list');
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
    .flatMap(([deviceId, devicePages]) =>
      selectDevicePages(devicePages).map(
        (page) =>
          ({
            id: page.id,
            deviceId,
            name: page.deviceName || deviceId,
            appId: page.appId,
            pageId: page.id,
            title: page.title,
            description: page.description,
            webSocketDebuggerUrl: page.webSocketDebuggerUrl,
            ...(page.rozenite?.platform ? { platform: page.rozenite.platform } : {}),
          }) satisfies MetroTarget,
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
};

export const resolveMetroTarget = async (
  host: string,
  port: number,
  requestedDeviceId?: string,
): Promise<MetroTarget> => {
  const targets = await getMetroTargets(host, port);

  if (targets.length === 0) {
    throw new Error(
      'No connected device is available. Open React Native DevTools for a device and try again.',
    );
  }

  if (requestedDeviceId) {
    // A target id names one page; a device id names every page on that
    // device. Both are accepted, so an id that identified a device before
    // targets became per-page still resolves. `getMetroTargets` returns a
    // device's pages in preference order, so the first match is the one
    // that would have been picked back when a device collapsed to a
    // single target.
    const selected =
      targets.find((target) => target.id === requestedDeviceId) ??
      targets.find((target) => target.deviceId === requestedDeviceId);

    if (!selected) {
      const validIds = targets.map((target) => target.id).join(', ');
      throw new Error(`Unknown deviceId "${requestedDeviceId}". Valid device IDs: ${validIds}`);
    }

    return selected;
  }

  // Count devices, not targets: one device hosting several pages (every
  // Lynx app with more than one card) is not an ambiguous *device* choice,
  // and asking the caller to pick between them would be a regression.
  const deviceIds = new Set(targets.map((target) => target.deviceId));

  if (deviceIds.size > 1) {
    throw new Error(
      'Multiple connected devices detected. Run `rozenite agent targets` and provide --deviceId <id>.',
    );
  }

  return targets[0];
};
