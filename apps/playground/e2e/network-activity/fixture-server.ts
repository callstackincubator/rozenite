/**
 * Deterministic HTTP, SSE and WebSocket fixture for the on-device Network
 * Activity harness (docs/adr/0002-network-activity-on-device-regression-harness.md).
 *
 * Used two ways:
 * - `startFixtureServer()` from the Vitest suite;
 * - run directly to poke at it by hand:
 *   `node apps/playground/e2e/network-activity/fixture-server.ts [port]`
 *   (Node >= 22.18 strips the types natively).
 *
 * Every response is a pure function of the request, and `Date` is not sent,
 * so the plugin events recorded against it can be snapshotted.
 */
import { createServer, STATUS_CODES, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

export const DEFAULT_FIXTURE_PORT = 38383;
/**
 * `::` with `ipv6Only: false` accepts IPv4 and IPv6 on every interface, so
 * `localhost` works on a simulator whichever address it resolves to first,
 * and an Android emulator still reaches the host at 10.0.2.2. Hosts without
 * IPv6 fall back to `0.0.0.0`.
 */
export const DEFAULT_FIXTURE_HOST = '::';
const IPV4_FALLBACK_HOST = '0.0.0.0';

export const FIXTURE_JSON = {
  fixture: 'rozenite-network-activity',
  items: [
    { id: 1, name: 'alpha' },
    { id: 2, name: 'beta' },
  ],
  ok: true,
} as const;

export const FIXTURE_TEXT = 'Hello from the Rozenite network fixture.\n';

/** A valid 1x1 RGBA PNG (70 bytes). */
export const FIXTURE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export const LARGE_BODY_SIZE = 2 * 1024 * 1024;
export const LARGE_BODY_CHUNK_SIZE = 64 * 1024;
const LARGE_BODY_CHUNK_DELAY_MS = 5;

/** Byte `i % 256` at offset `i`, so a receiver can verify it by sampling. */
export const createLargeBody = (): Buffer => {
  const body = Buffer.allocUnsafe(LARGE_BODY_SIZE);
  for (let index = 0; index < LARGE_BODY_SIZE; index += 1) {
    body[index] = index % 256;
  }
  return body;
};

export const SSE_EVENTS = [
  { event: 'message', data: 'message-1' },
  { event: 'ping', data: 'ping-1' },
  { event: 'message', data: 'message-2' },
  { event: 'ping', data: 'ping-2' },
  { event: 'message', data: 'message-3' },
] as const;
const SSE_EVENT_DELAY_MS = 25;

export const MAX_SLOW_MS = 30_000;
export const REDIRECT_TARGET = '/json';
export const SCENARIO_HEADER = 'x-rozenite-scenario';

/**
 * Request headers `/echo` leaves out of its reply because the client stack
 * adds them and they differ between OS versions; echoing them would make
 * the recorded response bodies device-specific.
 */
export const ECHO_EXCLUDED_HEADERS = new Set([
  'host',
  'user-agent',
  'accept-encoding',
  'accept-language',
  'connection',
  'keep-alive',
  'priority',
]);

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const EMPTY_BODY_STATUSES = new Set([204, 304]);
const MAX_ECHO_BODY_BYTES = 10 * 1024 * 1024;

export const maskBoundary = (value: string): string =>
  value.replace(/boundary=("?)[^";\s]+\1/gi, 'boundary=<boundary>');

export type EchoPart = {
  name: string | null;
  filename?: string;
  contentType?: string;
  size: number;
  value?: string;
};

export type EchoResponse = {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  contentType: string | null;
  bodyLength: number | null;
  body?: string;
  parts?: EchoPart[];
};

export type FixtureServer = {
  host: string;
  port: number;
  /** `http://localhost:<port>`, the origin an iOS simulator uses. */
  localUrl: string;
  close: () => Promise<void>;
};

export type StartFixtureServerOptions = {
  /** Defaults to 0 (an ephemeral port). */
  port?: number;
  host?: string;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const getScenario = (req: IncomingMessage): string | undefined => {
  const value = req.headers[SCENARIO_HEADER];
  return Array.isArray(value) ? value[0] : value;
};

const baseHeaders = (req: IncomingMessage): Record<string, string> => {
  const scenario = getScenario(req);
  return {
    'Cache-Control': 'no-store',
    ...(scenario ? { 'X-Rozenite-Scenario': scenario } : {}),
  };
};

const send = (
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  contentType: string | null,
  body?: string | Buffer,
  extraHeaders: Record<string, string> = {},
): void => {
  const headers: Record<string, string | number> = { ...baseHeaders(req), ...extraHeaders };
  if (EMPTY_BODY_STATUSES.has(status)) {
    res.writeHead(status, headers);
    res.end();
    return;
  }

  const payload =
    body === undefined ? Buffer.alloc(0) : typeof body === 'string' ? Buffer.from(body) : body;
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  headers['Content-Length'] = payload.byteLength;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : payload);
};

const sendJson = (
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  value: unknown,
  extraHeaders: Record<string, string> = {},
): void => {
  send(req, res, status, 'application/json; charset=utf-8', JSON.stringify(value), extraHeaders);
};

const readBody = (req: IncomingMessage): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.byteLength;
      if (size > MAX_ECHO_BODY_BYTES) {
        reject(new Error('Echo body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    // The cast bridges @types/node 18 and TypeScript 6's generic Uint8Array.
    req.on('end', () => resolve(Buffer.concat(chunks as unknown as Uint8Array[])));
    req.on('error', reject);
  });

const parseDisposition = (value: string) => {
  const name = /\bname="([^"]*)"/i.exec(value)?.[1] ?? null;
  const filename = /\bfilename="([^"]*)"/i.exec(value)?.[1];
  return { name, filename };
};

/** Minimal multipart/form-data reader: enough to summarise each part. */
export const parseMultipart = (body: Buffer, contentType: string): EchoPart[] => {
  const boundary = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const token = boundary?.[1] ?? boundary?.[2];
  if (!token) {
    return [];
  }

  const raw = body.toString('latin1');
  const segments = raw.split(`--${token}`);
  const parts: EchoPart[] = [];

  for (const segment of segments.slice(1)) {
    if (segment.startsWith('--')) {
      break;
    }

    const content = segment.replace(/^\r\n/, '').replace(/\r\n$/, '');
    const separator = content.indexOf('\r\n\r\n');
    if (separator < 0) {
      continue;
    }

    const headerLines = content.slice(0, separator).split('\r\n');
    const data = Buffer.from(content.slice(separator + 4), 'latin1');
    const headers = Object.fromEntries(
      headerLines.map((line) => {
        const colon = line.indexOf(':');
        return [line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()];
      }),
    );
    const { name, filename } = parseDisposition(headers['content-disposition'] ?? '');

    parts.push({
      name,
      ...(filename !== undefined ? { filename } : {}),
      ...(headers['content-type'] ? { contentType: headers['content-type'] } : {}),
      size: data.byteLength,
      ...(filename === undefined ? { value: data.toString('utf8') } : {}),
    });
  }

  return parts;
};

const handleEcho = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
  const body = await readBody(req);
  const rawContentType = req.headers['content-type'] ?? null;
  const isMultipart = rawContentType?.toLowerCase().startsWith('multipart/form-data') ?? false;

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || ECHO_EXCLUDED_HEADERS.has(key)) {
      continue;
    }
    // The multipart length depends on the boundary the client generated.
    if (isMultipart && key === 'content-length') {
      continue;
    }
    headers[key] = maskBoundary(Array.isArray(value) ? value.join(', ') : value);
  }

  const echo: EchoResponse = {
    method: req.method ?? 'GET',
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: Object.fromEntries(Object.entries(headers).sort(([a], [b]) => a.localeCompare(b))),
    contentType: rawContentType ? maskBoundary(rawContentType) : null,
    bodyLength: isMultipart ? null : body.byteLength,
    ...(isMultipart
      ? { parts: parseMultipart(body, rawContentType ?? '') }
      : { body: body.toString('utf8') }),
  };

  sendJson(req, res, 200, echo);
};

const handleSlow = (req: IncomingMessage, res: ServerResponse, url: URL) => {
  const requested = Number(url.searchParams.get('ms') ?? 1000);
  const delayMs = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 0), MAX_SLOW_MS)
    : 1000;
  const timer = setTimeout(() => {
    if (!res.destroyed) {
      sendJson(req, res, 200, { delayedMs: delayMs });
    }
  }, delayMs);
  // Fires when the response finishes or the client goes away (abort).
  res.on('close', () => clearTimeout(timer));
};

const handleLarge = async (req: IncomingMessage, res: ServerResponse, body: Buffer) => {
  res.writeHead(200, {
    ...baseHeaders(req),
    'Content-Type': 'application/octet-stream',
    'Content-Length': body.byteLength,
  });

  // Chunked writes with a short pause, so the client sees several progress
  // events rather than one.
  for (let offset = 0; offset < body.byteLength; offset += LARGE_BODY_CHUNK_SIZE) {
    if (res.destroyed) {
      return;
    }
    const chunk = body.subarray(offset, offset + LARGE_BODY_CHUNK_SIZE);
    if (!res.write(chunk)) {
      await new Promise<void>((resolve) => {
        const done = () => {
          res.off('drain', done);
          res.off('close', done);
          resolve();
        };
        res.on('drain', done);
        res.on('close', done);
      });
    }
    await sleep(LARGE_BODY_CHUNK_DELAY_MS);
  }

  res.end();
};

const handleSse = async (req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(200, {
    ...baseHeaders(req),
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.flushHeaders();

  for (const { event, data } of SSE_EVENTS) {
    await sleep(SSE_EVENT_DELAY_MS);
    if (res.destroyed) {
      return;
    }
    res.write(event === 'message' ? `data: ${data}\n\n` : `event: ${event}\ndata: ${data}\n\n`);
  }

  res.end();
};

export const startFixtureServer = async (
  options: StartFixtureServerOptions = {},
): Promise<FixtureServer> => {
  let host = options.host ?? DEFAULT_FIXTURE_HOST;
  let largeBody: Buffer | null = null;
  const sockets = new Set<Socket>();

  const server = createServer((req, res) => {
    res.sendDate = false;
    const url = new URL(req.url ?? '/', 'http://fixture.local');
    const statusMatch = /^\/status\/(\d{3})$/.exec(url.pathname);

    const route = async () => {
      if (url.pathname === '/json') {
        sendJson(req, res, 200, FIXTURE_JSON);
      } else if (url.pathname === '/text') {
        send(req, res, 200, 'text/plain; charset=utf-8', FIXTURE_TEXT);
      } else if (url.pathname === '/no-content') {
        send(req, res, 204, null);
      } else if (statusMatch) {
        const status = Number(statusMatch[1]);
        if (status < 200 || status > 599) {
          sendJson(req, res, 400, { error: `Unsupported status ${status}` });
        } else if (REDIRECT_STATUSES.has(status)) {
          sendJson(
            req,
            res,
            status,
            { status, location: REDIRECT_TARGET },
            { Location: REDIRECT_TARGET },
          );
        } else {
          sendJson(req, res, status, { status, statusText: STATUS_CODES[status] ?? null });
        }
      } else if (url.pathname === '/slow') {
        handleSlow(req, res, url);
      } else if (url.pathname === '/png') {
        send(req, res, 200, 'image/png', FIXTURE_PNG);
      } else if (url.pathname === '/large') {
        largeBody ??= createLargeBody();
        await handleLarge(req, res, largeBody);
      } else if (url.pathname === '/echo') {
        await handleEcho(req, res, url);
      } else if (url.pathname === '/sse') {
        await handleSse(req, res);
      } else {
        sendJson(req, res, 404, { error: 'Not found', path: url.pathname });
      }
    };

    route().catch((error: unknown) => {
      if (!res.headersSent && !res.destroyed) {
        sendJson(req, res, 500, { error: error instanceof Error ? error.message : String(error) });
      } else {
        res.destroy();
      }
    });
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', (ws) => {
    ws.on('message', (data, isBinary) => {
      ws.send(data, { binary: isBinary });
    });
  });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', 'http://fixture.local');
    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  const listen = (listenHost: string) =>
    new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen({ port: options.port ?? 0, host: listenHost, ipv6Only: false }, () => {
        server.off('error', reject);
        resolve();
      });
    });

  try {
    await listen(host);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const noIpv6 = code === 'EAFNOSUPPORT' || code === 'EADDRNOTAVAIL';
    if (options.host !== undefined || !noIpv6) {
      throw error;
    }
    host = IPV4_FALLBACK_HOST;
    await listen(host);
  }

  const { port } = server.address() as AddressInfo;

  return {
    host,
    port,
    localUrl: `http://localhost:${port}`,
    close: async () => {
      for (const client of wss.clients) {
        client.terminate();
      }
      wss.close();
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};

const isMainModule = (): boolean => {
  const entry = process.argv[1];
  return entry !== undefined && path.resolve(entry) === fileURLToPath(import.meta.url);
};

if (isMainModule()) {
  const requestedPort = Number(process.argv[2] ?? process.env.ROZENITE_FIXTURE_PORT);
  const port =
    Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : DEFAULT_FIXTURE_PORT;

  startFixtureServer({ port }).then(
    (fixture) => {
      process.stdout.write(
        [
          `Rozenite network fixture listening on port ${fixture.port} (${fixture.host === '::' ? 'IPv4 and IPv6' : fixture.host})`,
          `  iOS simulator:    http://localhost:${fixture.port}`,
          `  Android emulator: http://10.0.2.2:${fixture.port}`,
          '',
        ].join('\n'),
      );
      const shutdown = () => {
        void fixture.close().then(() => process.exit(0));
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    },
    (error: unknown) => {
      process.stderr.write(`Failed to start the fixture server: ${String(error)}\n`);
      process.exit(1);
    },
  );
}
