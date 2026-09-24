import axios from 'axios';
import { fetch as expoFetch } from 'expo/fetch';
import { fetch as nitroFetch } from 'react-native-nitro-fetch';
import { Platform } from 'react-native';
import EventSource from 'react-native-sse';
import { fetch as xhrFetch } from 'whatwg-fetch';
import {
  ABORT_AFTER_MS,
  ARRAY_BUFFER_CONTENT_TYPE,
  ARRAY_BUFFER_TEXT,
  BLOB_CONTENT_TYPE,
  BLOB_TEXT,
  FIXTURE_PING_TIMEOUT_MS,
  FORM_DATA_FIELDS,
  POST_JSON_PAYLOAD,
  SCENARIO_HEADER,
  SCENARIO_QUERY_PARAM,
  SLOW_RESPONSE_MS,
  TIMEOUT_AFTER_MS,
  WEBSOCKET_MESSAGES,
  type NetworkScenarioResult,
  type ScenarioName,
} from './e2e-scenario-contract';

/**
 * Scenarios for the on-device Network Activity regression harness
 * (docs/adr/0002-network-activity-on-device-regression-harness.md). They run
 * only when `app.run-network-scenario` is called by the Node suite in
 * `apps/playground/e2e/network-activity`, against its fixture server, and
 * report what the application observed. Nothing here is shown in the UI.
 *
 * `fetch-*` scenarios use `whatwg-fetch` (`xhrFetch`), React Native's own
 * XHR-backed fetch, because `globalThis.fetch` in this app is `expo/fetch`:
 * importing `expo` replaces it (expo/src/winter/runtime.native.ts). The
 * `global-fetch-get-json` scenario covers the global and reports which
 * implementation it was.
 */

type ResponseLike = {
  status: number;
  statusText: string;
  url: string;
  redirected?: boolean;
  headers: { get: (name: string) => string | null };
};

type ScenarioContext = {
  scenario: ScenarioName;
  baseUrl: string;
};

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const WEBSOCKET_STEP_TIMEOUT_MS = 5000;
const SSE_TIMEOUT_MS = 10000;
const SSE_SERVER_CLOSE_TIMEOUT_MS = 3000;
const SSE_EXPECTED_MESSAGES = 3;
const SSE_EXPECTED_PINGS = 2;

const scenarioHeaders = (scenario: ScenarioName): Record<string, string> => ({
  [SCENARIO_HEADER]: scenario,
});

const describeError = (error: unknown): { name: string; message: string } => {
  if (error && typeof error === 'object') {
    const { name, message } = error as { name?: unknown; message?: unknown };
    return {
      name: typeof name === 'string' ? name : 'Error',
      message: typeof message === 'string' ? message : String(error),
    };
  }

  return { name: typeof error, message: String(error) };
};

const describeResponse = (response: ResponseLike) => ({
  status: response.status,
  statusText: response.statusText,
  contentType: response.headers.get('content-type'),
  url: response.url,
  redirected: response.redirected,
  echoedScenarioHeader: response.headers.get(SCENARIO_HEADER),
});

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const encodeAscii = (text: string): Uint8Array => {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 0xff;
  }
  return bytes;
};

const hasPngSignature = (bytes: Uint8Array) =>
  PNG_SIGNATURE.every((value, index) => bytes[index] === value);

/** The fixture's `/large` body is byte `i % 256` at offset `i`; sample it. */
const hasLargeBodyPattern = (bytes: Uint8Array) => {
  if (bytes.length === 0) {
    return false;
  }

  for (let index = 0; index < bytes.length; index += 4099) {
    if (bytes[index] !== index % 256) {
      return false;
    }
  }

  const last = bytes.length - 1;
  return bytes[last] === last % 256;
};

const readJson = async (
  ctx: ScenarioContext,
  transport: NetworkScenarioResult['transport'],
  response: ResponseLike & { json: () => Promise<unknown> },
): Promise<NetworkScenarioResult> => ({
  scenario: ctx.scenario,
  transport,
  ...describeResponse(response),
  json: await response.json(),
});

const readText = async (
  ctx: ScenarioContext,
  transport: NetworkScenarioResult['transport'],
  response: ResponseLike & { text: () => Promise<string> },
): Promise<NetworkScenarioResult> => {
  const text = await response.text();
  return {
    scenario: ctx.scenario,
    transport,
    ...describeResponse(response),
    bodyLength: text.length,
    text,
  };
};

const failure = (
  ctx: ScenarioContext,
  transport: NetworkScenarioResult['transport'],
  error: unknown,
  extra: Partial<NetworkScenarioResult> = {},
): NetworkScenarioResult => ({
  scenario: ctx.scenario,
  transport,
  error: describeError(error),
  ...extra,
});

const postJsonInit = (ctx: ScenarioContext) => ({
  method: 'POST',
  headers: {
    ...scenarioHeaders(ctx.scenario),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(POST_JSON_PAYLOAD),
});

const abortAfter = (ms: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
};

const slowUrl = (ctx: ScenarioContext) => `${ctx.baseUrl}/slow?ms=${SLOW_RESPONSE_MS}`;

const scenarios: Record<ScenarioName, (ctx: ScenarioContext) => Promise<NetworkScenarioResult>> = {
  'fetch-get-json': async (ctx) =>
    readJson(
      ctx,
      'fetch',
      await xhrFetch(`${ctx.baseUrl}/json`, { headers: scenarioHeaders(ctx.scenario) }),
    ),

  'fetch-post-json': async (ctx) =>
    readJson(ctx, 'fetch', await xhrFetch(`${ctx.baseUrl}/echo`, postJsonInit(ctx))),

  'fetch-post-form-data': async (ctx) => {
    const formData = new FormData();
    Object.entries(FORM_DATA_FIELDS).forEach(([key, value]) => formData.append(key, value));
    return readJson(
      ctx,
      'fetch',
      await xhrFetch(`${ctx.baseUrl}/echo`, {
        method: 'POST',
        headers: scenarioHeaders(ctx.scenario),
        body: formData,
      }),
    );
  },

  'fetch-post-blob': async (ctx) =>
    readJson(
      ctx,
      'fetch',
      await xhrFetch(`${ctx.baseUrl}/echo`, {
        method: 'POST',
        headers: {
          ...scenarioHeaders(ctx.scenario),
          'Content-Type': BLOB_CONTENT_TYPE,
        },
        body: new Blob([BLOB_TEXT], { type: BLOB_CONTENT_TYPE }),
      }),
    ),

  'fetch-post-array-buffer': async (ctx) =>
    readJson(
      ctx,
      'fetch',
      await xhrFetch(`${ctx.baseUrl}/echo`, {
        method: 'POST',
        headers: {
          ...scenarioHeaders(ctx.scenario),
          'Content-Type': ARRAY_BUFFER_CONTENT_TYPE,
        },
        body: encodeAscii(ARRAY_BUFFER_TEXT).buffer as ArrayBuffer,
      }),
    ),

  'fetch-abort': async (ctx) => {
    const abort = abortAfter(ABORT_AFTER_MS);
    try {
      const response = await xhrFetch(slowUrl(ctx), {
        headers: scenarioHeaders(ctx.scenario),
        signal: abort.signal,
      });
      return await readText(ctx, 'fetch', response);
    } catch (error) {
      return failure(ctx, 'fetch', error);
    } finally {
      abort.cancel();
    }
  },

  'fetch-timeout': async (ctx) => {
    // Prefer the platform's timeout signal; fall back to a manual abort on
    // runtimes whose AbortSignal polyfill lacks `timeout()`.
    const signalApi = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal };
    const manual = typeof signalApi.timeout === 'function' ? null : abortAfter(TIMEOUT_AFTER_MS);
    const signal = manual ? manual.signal : signalApi.timeout!(TIMEOUT_AFTER_MS);
    const timeoutMechanism = manual ? 'manual-abort' : 'AbortSignal.timeout';

    try {
      const response = await xhrFetch(slowUrl(ctx), {
        headers: scenarioHeaders(ctx.scenario),
        signal,
      });
      return { ...(await readText(ctx, 'fetch', response)), timeoutMechanism };
    } catch (error) {
      return failure(ctx, 'fetch', error, { timeoutMechanism });
    } finally {
      manual?.cancel();
    }
  },

  'fetch-204': async (ctx) =>
    readText(
      ctx,
      'fetch',
      await xhrFetch(`${ctx.baseUrl}/no-content`, { headers: scenarioHeaders(ctx.scenario) }),
    ),

  'fetch-redirect': async (ctx) =>
    readJson(
      ctx,
      'fetch',
      await xhrFetch(`${ctx.baseUrl}/status/301`, { headers: scenarioHeaders(ctx.scenario) }),
    ),

  'fetch-png': async (ctx) => {
    const response = await xhrFetch(`${ctx.baseUrl}/png`, {
      headers: scenarioHeaders(ctx.scenario),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      scenario: ctx.scenario,
      transport: 'fetch',
      ...describeResponse(response),
      bodyLength: bytes.byteLength,
      pngSignatureValid: hasPngSignature(bytes),
    };
  },

  'fetch-large-download': async (ctx) => {
    const response = await xhrFetch(`${ctx.baseUrl}/large`, {
      headers: scenarioHeaders(ctx.scenario),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      scenario: ctx.scenario,
      transport: 'fetch',
      ...describeResponse(response),
      bodyLength: bytes.byteLength,
      largeBodyPatternValid: hasLargeBodyPattern(bytes),
    };
  },

  'fetch-status-404': async (ctx) =>
    readJson(
      ctx,
      'fetch',
      await xhrFetch(`${ctx.baseUrl}/status/404`, { headers: scenarioHeaders(ctx.scenario) }),
    ),

  'fetch-status-500': async (ctx) =>
    readJson(
      ctx,
      'fetch',
      await xhrFetch(`${ctx.baseUrl}/status/500`, { headers: scenarioHeaders(ctx.scenario) }),
    ),

  'global-fetch-get-json': async (ctx) => {
    const globalFetch = globalThis.fetch as typeof globalThis.fetch & { polyfill?: unknown };
    const isExpoFetch = globalFetch === (expoFetch as unknown);
    const isWhatwgFetch = globalFetch === xhrFetch;
    const hasPolyfillFlag = globalFetch.polyfill === true;
    const response = await globalFetch(`${ctx.baseUrl}/json`, {
      headers: scenarioHeaders(ctx.scenario),
    });
    return {
      ...(await readJson(ctx, 'global-fetch', response)),
      globalFetch: {
        implementation: isExpoFetch
          ? 'expo/fetch'
          : isWhatwgFetch || hasPolyfillFlag
            ? 'whatwg-fetch'
            : 'other',
        isExpoFetch,
        isWhatwgFetch,
        hasPolyfillFlag,
      },
    };
  },

  'fixture-ping': async (ctx) => {
    // Reachability check for the suite's setup: fails fast instead of every
    // scenario waiting on the tool-call timeout.
    const abort = abortAfter(FIXTURE_PING_TIMEOUT_MS);
    try {
      const response = await xhrFetch(`${ctx.baseUrl}/json`, {
        headers: scenarioHeaders(ctx.scenario),
        signal: abort.signal,
      });
      return {
        scenario: ctx.scenario,
        transport: 'global-fetch',
        platform: Platform.OS,
        status: response.status,
      };
    } catch (error) {
      return failure(ctx, 'global-fetch', error, { platform: Platform.OS });
    } finally {
      abort.cancel();
    }
  },

  'axios-get-json': async (ctx) => {
    const response = await axios.get(`${ctx.baseUrl}/json`, {
      headers: scenarioHeaders(ctx.scenario),
    });
    return {
      scenario: ctx.scenario,
      transport: 'axios',
      status: response.status,
      statusText: response.statusText,
      contentType: String(response.headers['content-type'] ?? '') || null,
      echoedScenarioHeader: String(response.headers['x-rozenite-scenario'] ?? '') || null,
      json: response.data,
    };
  },

  'axios-post-json': async (ctx) => {
    const response = await axios.post(`${ctx.baseUrl}/echo`, POST_JSON_PAYLOAD, {
      headers: scenarioHeaders(ctx.scenario),
    });
    return {
      scenario: ctx.scenario,
      transport: 'axios',
      status: response.status,
      statusText: response.statusText,
      contentType: String(response.headers['content-type'] ?? '') || null,
      echoedScenarioHeader: String(response.headers['x-rozenite-scenario'] ?? '') || null,
      json: response.data,
    };
  },

  'expo-get-json': async (ctx) =>
    readJson(
      ctx,
      'expo',
      await expoFetch(`${ctx.baseUrl}/json`, { headers: scenarioHeaders(ctx.scenario) }),
    ),

  'expo-abort': async (ctx) => {
    const abort = abortAfter(ABORT_AFTER_MS);
    try {
      const response = await expoFetch(slowUrl(ctx), {
        headers: scenarioHeaders(ctx.scenario),
        signal: abort.signal,
      });
      return await readText(ctx, 'expo', response);
    } catch (error) {
      return failure(ctx, 'expo', error);
    } finally {
      abort.cancel();
    }
  },

  'nitro-get-json': async (ctx) =>
    readJson(
      ctx,
      'nitro',
      await nitroFetch(`${ctx.baseUrl}/json`, { headers: scenarioHeaders(ctx.scenario) }),
    ),

  'nitro-post-json': async (ctx) =>
    readJson(ctx, 'nitro', await nitroFetch(`${ctx.baseUrl}/echo`, postJsonInit(ctx))),

  'nitro-abort': async (ctx) => {
    const abort = abortAfter(ABORT_AFTER_MS);
    try {
      const response = await nitroFetch(slowUrl(ctx), {
        headers: scenarioHeaders(ctx.scenario),
        signal: abort.signal,
      });
      return await readText(ctx, 'nitro', response);
    } catch (error) {
      return failure(ctx, 'nitro', error);
    } finally {
      abort.cancel();
    }
  },

  'websocket-echo': (ctx) => runWebSocketEcho(ctx),

  'sse-stream': (ctx) => runSSEStream(ctx),
};

const runWebSocketEcho = async (ctx: ScenarioContext): Promise<NetworkScenarioResult> => {
  const url = `${ctx.baseUrl.replace(/^http/, 'ws')}/ws?${SCENARIO_QUERY_PARAM}=${ctx.scenario}`;
  const sent: string[] = [];
  const received: string[] = [];
  const pendingMessages: ((data: string) => void)[] = [];
  const ws = new WebSocket(url);

  const closed = new Promise<{ code: number; reason: string; wasClean: boolean | null }>(
    (resolve) => {
      ws.onclose = (event) =>
        resolve({
          code: event.code,
          reason: event.reason ?? '',
          // React Native's close event does not always carry `wasClean`.
          wasClean: typeof event.wasClean === 'boolean' ? event.wasClean : null,
        });
    },
  );

  ws.onmessage = (event) => {
    const data = String(event.data);
    received.push(data);
    pendingMessages.shift()?.(data);
  };

  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error('WebSocket failed to open'));
      }),
      WEBSOCKET_STEP_TIMEOUT_MS,
      'WebSocket open',
    );

    for (const message of WEBSOCKET_MESSAGES) {
      const echoed = new Promise<string>((resolve) => pendingMessages.push(resolve));
      ws.send(message);
      sent.push(message);
      await withTimeout(echoed, WEBSOCKET_STEP_TIMEOUT_MS, `WebSocket echo of "${message}"`);
    }

    ws.close(1000, 'scenario complete');
    const close = await withTimeout(closed, WEBSOCKET_STEP_TIMEOUT_MS, 'WebSocket close');

    return {
      scenario: ctx.scenario,
      transport: 'websocket',
      websocket: {
        sent,
        received,
        closeCode: close.code,
        closeReason: close.reason,
        wasClean: close.wasClean,
      },
    };
  } catch (error) {
    ws.close();
    return failure(ctx, 'websocket', error, {
      websocket: { sent, received, closeCode: null, closeReason: null, wasClean: null },
    });
  }
};

const runSSEStream = async (ctx: ScenarioContext): Promise<NetworkScenarioResult> => {
  const messages: string[] = [];
  const pings: string[] = [];
  const errors: string[] = [];
  let opened = false;

  // `pollingInterval: 0` stops react-native-sse from reconnecting once the
  // fixture ends the stream, so exactly one request is made.
  const eventSource = new EventSource<'ping'>(`${ctx.baseUrl}/sse`, {
    headers: scenarioHeaders(ctx.scenario),
    pollingInterval: 0,
    timeoutBeforeConnection: 0,
  });

  const received = new Promise<void>((resolve) => {
    const check = () => {
      if (messages.length >= SSE_EXPECTED_MESSAGES && pings.length >= SSE_EXPECTED_PINGS) {
        resolve();
      }
    };

    eventSource.addEventListener('open', () => {
      opened = true;
    });
    eventSource.addEventListener('message', (event) => {
      messages.push(event.data ?? '');
      check();
    });
    eventSource.addEventListener('ping', (event) => {
      pings.push(event.data ?? '');
      check();
    });
    eventSource.addEventListener('error', (event) => {
      errors.push('message' in event ? String(event.message) : event.type);
    });
  });

  let serverClosed = false;

  try {
    await withTimeout(received, SSE_TIMEOUT_MS, 'SSE stream');

    // react-native-sse dispatches nothing when the server ends the stream, so
    // read the underlying XHR state. Closing before it is DONE would abort the
    // request and turn a completed request into a cancelled one.
    const deadline = Date.now() + SSE_SERVER_CLOSE_TIMEOUT_MS;
    const internal = eventSource as unknown as { _xhr?: { readyState: number } | null };
    while (Date.now() < deadline) {
      if (internal._xhr?.readyState === 4) {
        serverClosed = true;
        break;
      }
      await sleep(20);
    }
  } catch (error) {
    errors.push(describeError(error).message);
  } finally {
    eventSource.close();
  }

  return {
    scenario: ctx.scenario,
    transport: 'sse',
    sse: { opened, messages, pings, errors, serverClosed },
  };
};

const transportOf = (scenario: ScenarioName): NetworkScenarioResult['transport'] => {
  if (scenario === 'global-fetch-get-json' || scenario === 'fixture-ping') {
    return 'global-fetch';
  }
  const prefix = scenario.split('-', 1)[0];
  return prefix === 'axios' ||
    prefix === 'expo' ||
    prefix === 'nitro' ||
    prefix === 'websocket' ||
    prefix === 'sse'
    ? prefix
    : 'fetch';
};

export const runNetworkScenario = async (
  scenario: ScenarioName,
  baseUrl: string,
): Promise<NetworkScenarioResult> => {
  const ctx: ScenarioContext = { scenario, baseUrl: baseUrl.replace(/\/+$/, '') };

  try {
    return await scenarios[scenario](ctx);
  } catch (error) {
    // Scenarios that expect a failure catch it themselves; anything reaching
    // here is reported rather than thrown, so the suite sees what happened.
    return failure(ctx, transportOf(scenario), error);
  }
};
