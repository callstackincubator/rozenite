import { request as httpRequest } from 'node:http';
import type { MetroTarget } from './daemon-protocol.js';

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
          reject();
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
  }).catch(() => {
    throw new Error(`Unable to reach Metro at http://${host}:${port}. Make sure Metro is running and reachable, then try again.`);
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

export const getMetroTargets = async (
  host: string,
  port: number,
): Promise<MetroTarget[]> => {
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

export const resolveMetroTarget = async (
  host: string,
  port: number,
  requestedDeviceId?: string,
): Promise<MetroTarget> => {
  const targets = await getMetroTargets(host, port);

  if (targets.length === 0) {
    throw new Error(
      `No connected device is available. Open React Native DevTools for a device and try again.`,
    );
  }

  if (requestedDeviceId) {
    const selected = targets.find((target) => target.id === requestedDeviceId);
    if (!selected) {
      const validIds = targets.map((target) => target.id).join(', ');
      throw new Error(`Unknown deviceId "${requestedDeviceId}". Valid device IDs: ${validIds}`);
    }
    return selected;
  }

  if (targets.length > 1) {
    throw new Error(
      'Multiple connected devices detected. Run `rozenite agent targets` and provide --deviceId <id>.',
    );
  }

  return targets[0];
};
