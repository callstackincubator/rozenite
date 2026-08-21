/**
 * Reads the device connection target from the page URL, mirroring the
 * convention React Native DevTools' Fusebox frontend uses:
 *
 *   ?ws=<url-encoded /inspector/debug?device=<id>&page=<n>>&appId=<app id>
 *
 * This stays a runtime query parameter rather than a build-time constant so
 * the embed-vs-serve decision remains reversible: the same built app can be
 * pointed at whichever device/page Metro is currently serving.
 */

export type ParsedTarget = {
  /** Absolute WebSocket URL to open for the initial connection. */
  webSocketDebuggerUrl: string;
  /**
   * Device id extracted from the `ws` parameter's `device` query param.
   * Used to re-resolve the target (via Metro's `/json/list`) after a
   * recoverable disconnect, since the page id in `webSocketDebuggerUrl` can
   * change underneath a live connection.
   */
  deviceId: string;
  /**
   * Page id from the `ws` parameter's `page` query param, when it has one.
   *
   * A device can host several pages -- every Lynx card is one, and a React
   * Native app gains one per extra VM -- so re-resolving by `deviceId`
   * alone can land on a different page than the one being debugged. Kept
   * so reconnection can go back to the same page.
   */
  pageId: string | null;
  /** Passed straight through from the `appId` query parameter. */
  appId: string;
};

export class TargetUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TargetUrlError';
  }
}

const resolveWebSocketUrl = (
  wsParam: string,
  location: { protocol: string; host: string },
): string => {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';

  // Fusebox accepts either a path rooted at the current host (the common
  // case: this app and the device's debugger endpoint are served by the
  // same Metro instance) or an explicit `host:port/path`.
  return wsParam.startsWith('/')
    ? `${scheme}//${location.host}${wsParam}`
    : `${scheme}//${wsParam}`;
};

export const parseTargetFromUrl = (url: URL = new URL(window.location.href)): ParsedTarget => {
  const wsParam = url.searchParams.get('ws');

  if (!wsParam) {
    throw new TargetUrlError(
      'Missing required "ws" query parameter. Expected a URL such as ' +
        '?ws=%2Finspector%2Fdebug%3Fdevice%3D<id>%26page%3D<n>&appId=<app id>.',
    );
  }

  const webSocketDebuggerUrl = resolveWebSocketUrl(wsParam, url);

  let deviceId: string | null;
  let pageId: string | null;
  try {
    const params = new URL(webSocketDebuggerUrl).searchParams;
    deviceId = params.get('device');
    pageId = params.get('page');
  } catch {
    throw new TargetUrlError(`The "ws" query parameter is not a valid URL: "${wsParam}".`);
  }

  if (!deviceId) {
    throw new TargetUrlError(`The "ws" query parameter is missing a "device" id: "${wsParam}".`);
  }

  return {
    webSocketDebuggerUrl,
    deviceId,
    pageId,
    appId: url.searchParams.get('appId') ?? '',
  };
};
