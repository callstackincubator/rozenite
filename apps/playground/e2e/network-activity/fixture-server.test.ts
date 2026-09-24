import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import {
  FIXTURE_JSON,
  FIXTURE_PNG,
  FIXTURE_TEXT,
  LARGE_BODY_SIZE,
  SSE_EVENTS,
  startFixtureServer,
  type EchoResponse,
  type FixtureServer,
} from './fixture-server';

let fixture: FixtureServer;
let base: string;

beforeAll(async () => {
  fixture = await startFixtureServer({ host: '127.0.0.1' });
  base = `http://127.0.0.1:${fixture.port}`;
});

afterAll(async () => {
  await fixture.close();
});

const scenarioHeaders = { 'X-Rozenite-Scenario': 'unit-test' };

describe('fixture server', () => {
  it('serves JSON without volatile headers and echoes the scenario header', async () => {
    const response = await fetch(`${base}/json`, { headers: scenarioHeaders });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('date')).toBeNull();
    expect(response.headers.get('x-rozenite-scenario')).toBe('unit-test');
    const body = await response.text();
    expect(response.headers.get('content-length')).toBe(String(Buffer.byteLength(body)));
    expect(JSON.parse(body)).toEqual(FIXTURE_JSON);
  });

  it('serves plain text', async () => {
    const response = await fetch(`${base}/text`);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toBe(FIXTURE_TEXT);
  });

  it.each([201, 400, 404, 500])(
    'answers /status/%i with that status and a JSON body',
    async (status) => {
      const response = await fetch(`${base}/status/${status}`);
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ status });
    },
  );

  it('redirects /status/301 to /json', async () => {
    const manual = await fetch(`${base}/status/301`, { redirect: 'manual' });
    expect(manual.status).toBe(301);
    expect(manual.headers.get('location')).toBe('/json');

    const followed = await fetch(`${base}/status/301`);
    expect(followed.status).toBe(200);
    expect(followed.url).toBe(`${base}/json`);
    expect(await followed.json()).toEqual(FIXTURE_JSON);
  });

  it('answers /no-content with an empty 204', async () => {
    const response = await fetch(`${base}/no-content`, { headers: scenarioHeaders });
    expect(response.status).toBe(204);
    expect(response.headers.get('x-rozenite-scenario')).toBe('unit-test');
    expect(await response.text()).toBe('');
  });

  it('delays /slow and survives a client abort', async () => {
    const startedAt = Date.now();
    const response = await fetch(`${base}/slow?ms=60`);
    expect(await response.json()).toEqual({ delayedMs: 60 });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(50);

    await expect(
      fetch(`${base}/slow?ms=5000`, { signal: AbortSignal.timeout(50) }),
    ).rejects.toThrow();
    expect((await fetch(`${base}/json`)).status).toBe(200);
  });

  it('serves a valid PNG', async () => {
    const response = await fetch(`${base}/png`);
    expect(response.headers.get('content-type')).toBe('image/png');
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.toString('base64')).toBe(FIXTURE_PNG.toString('base64'));
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    // IHDR: 1x1 pixel.
    expect(bytes.readUInt32BE(16)).toBe(1);
    expect(bytes.readUInt32BE(20)).toBe(1);
  });

  it('streams 2 MiB from /large with a Content-Length', async () => {
    const response = await fetch(`${base}/large`);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('content-length')).toBe(String(LARGE_BODY_SIZE));
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.byteLength).toBe(LARGE_BODY_SIZE);
    expect(bytes[0]).toBe(0);
    expect(bytes[255]).toBe(255);
    expect(bytes[256]).toBe(0);
    expect(bytes[LARGE_BODY_SIZE - 1]).toBe((LARGE_BODY_SIZE - 1) % 256);
  });

  it('echoes the method, filtered headers and raw body', async () => {
    const payload = JSON.stringify({ hello: 'world' });
    const response = await fetch(`${base}/echo?x=1`, {
      method: 'PUT',
      headers: { ...scenarioHeaders, 'Content-Type': 'application/json' },
      body: payload,
    });
    const echo = (await response.json()) as EchoResponse;
    expect(echo).toMatchObject({
      method: 'PUT',
      path: '/echo',
      query: { x: '1' },
      contentType: 'application/json',
      bodyLength: payload.length,
      body: payload,
    });
    expect(echo.headers['x-rozenite-scenario']).toBe('unit-test');
    expect(echo.headers['content-type']).toBe('application/json');
    expect(echo.headers).not.toHaveProperty('host');
    expect(echo.headers).not.toHaveProperty('user-agent');
  });

  it('summarises multipart bodies and masks the boundary', async () => {
    const form = new FormData();
    form.append('name', 'Rozenite');
    form.append('file', new Blob(['abc'], { type: 'text/plain' }), 'a.txt');
    const response = await fetch(`${base}/echo`, { method: 'POST', body: form });
    const echo = (await response.json()) as EchoResponse;
    expect(echo.contentType).toBe('multipart/form-data; boundary=<boundary>');
    expect(echo.headers).not.toHaveProperty('content-length');
    expect(echo.bodyLength).toBeNull();
    expect(echo.parts).toEqual([
      { name: 'name', size: 8, value: 'Rozenite' },
      { name: 'file', filename: 'a.txt', contentType: 'text/plain', size: 3 },
    ]);
  });

  it('streams SSE messages and pings, then closes', async () => {
    const response = await fetch(`${base}/sse`);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    const text = await response.text();
    const events = text
      .split('\n\n')
      .filter(Boolean)
      .map((block) => {
        const lines = Object.fromEntries(
          block
            .split('\n')
            .map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 2)]),
        );
        return { event: lines.event ?? 'message', data: lines.data };
      });
    expect(events).toEqual(SSE_EVENTS);
  });

  it('echoes WebSocket messages on /ws and closes cleanly', async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${fixture.port}/ws?scenario=unit-test`);
    const received: string[] = [];
    socket.on('message', (data) => received.push(String(data)));
    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve());
      socket.once('error', reject);
    });

    socket.send('hello-1');
    socket.send('hello-2');
    await expect.poll(() => received).toEqual(['hello-1', 'hello-2']);

    const code = await new Promise<number>((resolve) => {
      socket.once('close', (closeCode) => resolve(closeCode));
      socket.close(1000, 'done');
    });
    expect(code).toBe(1000);
  });

  it('answers unknown paths with 404', async () => {
    const response = await fetch(`${base}/nope`);
    expect(response.status).toBe(404);
  });
});
