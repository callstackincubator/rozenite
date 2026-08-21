/**
 * Builds the `ws(s)://<host>` prefix `/json/list` uses for
 * `webSocketDebuggerUrl`, from the incoming HTTP request rather than from
 * any configured host/port. That is what lets the same code work
 * unmodified behind a reverse proxy or tunnel, and on whatever port the
 * dev server actually ended up bound to: the request already carries the
 * host the browser used to reach us in its `Host` header, and, if it went
 * through a TLS-terminating proxy, that proxy's own signal for it in
 * `x-forwarded-proto`.
 */
import type { IncomingMessage } from 'node:http';

const isTlsSocket = (socket: IncomingMessage['socket']): boolean =>
  Boolean((socket as { encrypted?: boolean }).encrypted);

const isForwardedHttps = (header: string | string[] | undefined): boolean => {
  const value = Array.isArray(header) ? header[0] : header;
  return value?.split(',', 1)[0]?.trim().toLowerCase() === 'https';
};

export const resolveWebSocketOrigin = (request: IncomingMessage): string => {
  const host = request.headers.host ?? 'localhost';
  const scheme =
    isTlsSocket(request.socket) || isForwardedHttps(request.headers['x-forwarded-proto'])
      ? 'wss'
      : 'ws';
  return `${scheme}://${host}`;
};
