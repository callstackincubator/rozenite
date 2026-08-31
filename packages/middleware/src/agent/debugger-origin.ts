import { request as httpRequest } from 'node:http';

/**
 * How long to wait for Expo's debugger endpoint before giving up and
 * falling back. It is a request to the dev server we are already talking
 * to, so anything slower than this means the endpoint is not there.
 */
const EXPO_DEBUGGER_TIMEOUT_MS = 2000;

const formatHost = (host: string): string =>
  host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;

/**
 * The `Origin` a debugger WebSocket must present, derived from the URL it
 * connects to.
 *
 * This is only ever right by coincidence for Expo (see
 * `fetchExpoDebuggerOrigin`), because `/json/list` builds
 * `webSocketDebuggerUrl` from the *requester's* `Host` header — ask it as
 * `localhost` and it answers `localhost`, ask it as `127.0.0.1` and it
 * answers `127.0.0.1`. It is still the right fallback: it preserves an
 * explicitly configured remote or `wss:` dev server, and React Native's
 * own middleware accepts any loopback spelling.
 */
export const getDebuggerWebSocketOrigin = (webSocketDebuggerUrl: string): string => {
  const url = new URL(webSocketDebuggerUrl);
  const protocol = url.protocol === 'wss:' ? 'https:' : 'http:';

  return `${protocol}//${url.host}`;
};

type ExpoInspectorApp = {
  webSocketDebuggerUrl?: unknown;
};

const requestExpoInspectorApp = (
  host: string,
  port: number,
  appId: string,
): Promise<ExpoInspectorApp | null> => {
  const url = new URL(`http://${formatHost(host)}:${port}/_expo/debugger`);
  url.searchParams.set('appId', appId);

  return new Promise<ExpoInspectorApp | null>((resolve) => {
    // Deliberately no `Origin` header: Expo guards this route with the
    // same exact-host check it applies to the debugger socket, and that
    // check passes a request with no `Origin` at all. Sending one would
    // require already knowing the answer we are asking for.
    const req = httpRequest(url, { method: 'GET' }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        resolve(null);
        return;
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data) as ExpoInspectorApp);
        } catch {
          resolve(null);
        }
      });
    });

    req.setTimeout(EXPO_DEBUGGER_TIMEOUT_MS, () => req.destroy());
    req.once('error', () => resolve(null));
    req.end();
  });
};

/**
 * The `Origin` Expo will accept for a debugger WebSocket, or `null` when
 * the dev server is not Expo (or cannot answer).
 *
 * React Native's dev-middleware accepts any loopback spelling during the
 * upgrade, but Expo adds a second check *after* it and terminates the
 * socket unless the `Origin` host matches its own `serverBaseUrl`
 * exactly. That host is environment-dependent — `127.0.0.1` normally,
 * `REACT_NATIVE_PACKAGER_HOSTNAME` when set — so it cannot be guessed
 * from the address we happen to be using.
 *
 * `/_expo/debugger` resolves its target by querying `/json/list` through
 * `serverBaseUrl` itself, so the `webSocketDebuggerUrl` it returns always
 * carries Expo's canonical host regardless of how this request is
 * addressed. That makes it an authoritative answer rather than another
 * guess.
 *
 * Used for the `Origin` only. The route reports a single app and filters
 * to pages that support native reloads, so it is not a substitute for
 * target discovery.
 */
export const fetchExpoDebuggerOrigin = async (
  host: string,
  port: number,
  appId: string,
): Promise<string | null> => {
  if (!appId) {
    return null;
  }

  const app = await requestExpoInspectorApp(host, port, appId);

  if (!app || typeof app.webSocketDebuggerUrl !== 'string') {
    return null;
  }

  try {
    return getDebuggerWebSocketOrigin(app.webSocketDebuggerUrl);
  } catch {
    return null;
  }
};

/**
 * The `Origin` to present when opening a debugger WebSocket: Expo's own
 * answer when it has one, otherwise the origin implied by the target URL.
 */
export const resolveDebuggerOrigin = async (options: {
  host: string;
  port: number;
  appId: string;
  webSocketDebuggerUrl: string;
}): Promise<string> => {
  const expoOrigin = await fetchExpoDebuggerOrigin(options.host, options.port, options.appId);

  return expoOrigin ?? getDebuggerWebSocketOrigin(options.webSocketDebuggerUrl);
};
