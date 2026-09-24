/**
 * On-device regression suite for @rozenite/network-activity-plugin
 * (docs/adr/0002-network-activity-on-device-regression-harness.md).
 *
 * Application-side checks use `expect.soft`, so a scenario the current
 * implementation breaks still records its capture snapshot next to the
 * failure.
 *
 * Needs a running Metro and the playground on a simulator or device; it is
 * not part of `pnpm test`. How to run it and record baselines:
 * docs/agents/network-activity-e2e.md.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ARRAY_BUFFER_CONTENT_TYPE,
  ARRAY_BUFFER_TEXT,
  BLOB_CONTENT_TYPE,
  BLOB_TEXT,
  FORM_DATA_FIELDS,
  NETWORK_SCENARIO_NAMES,
  POST_JSON_PAYLOAD,
  WEBSOCKET_MESSAGES,
  type NetworkScenarioName,
  type NetworkScenarioResult,
} from '../../src/app/utils/network-activity/e2e-scenario-contract';
import {
  FIXTURE_JSON,
  FIXTURE_PNG,
  LARGE_BODY_SIZE,
  REDIRECT_TARGET,
  SSE_EVENTS,
  startFixtureServer,
  type EchoResponse,
  type FixtureServer,
} from './fixture-server';
import { readBaselineManifest, writeBaselineManifest } from './baseline';
import { HarnessSetupError, openHarness, readHarnessConfig, type Harness } from './harness';
import { createNormaliser } from './normalise';
import type { CaptureKind } from './observers';

type ScenarioCase = {
  scenario: NetworkScenarioName;
  kind: CaptureKind;
  assertApp: (result: NetworkScenarioResult) => void;
};

const expectResponse = (result: NetworkScenarioResult, status: number) => {
  expect.soft(result.error, `${result.scenario} should not fail in the app`).toBeUndefined();
  expect.soft(result.status).toBe(status);
  expect.soft(result.echoedScenarioHeader).toBe(result.scenario);
};

const expectJsonFixture = (result: NetworkScenarioResult) => {
  expectResponse(result, 200);
  expect.soft(result.contentType).toMatch(/^application\/json/);
  expect.soft(result.json).toEqual(FIXTURE_JSON);
};

const expectEcho = (
  result: NetworkScenarioResult,
  expected: { contentType: RegExp; body?: string },
): Partial<EchoResponse> => {
  expectResponse(result, 200);
  // A scenario that failed in the app has no `json`; report that through the
  // soft assertions instead of throwing before the snapshot is taken.
  const echo = (result.json ?? {}) as Partial<EchoResponse>;
  expect.soft(echo.method).toBe('POST');
  expect.soft(echo.path).toBe('/echo');
  expect.soft(echo.headers?.['x-rozenite-scenario']).toBe(result.scenario);
  expect.soft(echo.contentType).toMatch(expected.contentType);
  if (expected.body !== undefined) {
    expect.soft(echo.body).toBe(expected.body);
    expect.soft(echo.bodyLength).toBe(Buffer.byteLength(expected.body));
  }
  return echo;
};

/**
 * whatwg-fetch (the `fetch-*` scenarios) and react-native-nitro-fetch reject
 * with an `AbortError`; expo/fetch rejects with a `FetchError` whose message
 * says the request was aborted or cancelled.
 */
const expectAborted = (result: NetworkScenarioResult) => {
  expect.soft(result.status, `${result.scenario} should not produce a response`).toBeUndefined();
  expect.soft(result.error).toBeDefined();
  expect.soft(`${result.error?.name}: ${result.error?.message}`).toMatch(/abort|cancel|timeout/i);
};

const expectStatusFixture = (result: NetworkScenarioResult, status: number) => {
  expectResponse(result, status);
  expect.soft(result.json).toMatchObject({ status });
};

const CASES: ScenarioCase[] = [
  { scenario: 'fetch-get-json', kind: 'http', assertApp: expectJsonFixture },
  {
    scenario: 'fetch-post-json',
    kind: 'http',
    assertApp: (result) =>
      expectEcho(result, {
        contentType: /^application\/json/,
        body: JSON.stringify(POST_JSON_PAYLOAD),
      }),
  },
  {
    scenario: 'fetch-post-form-data',
    kind: 'http',
    assertApp: (result) => {
      const echo = expectEcho(result, {
        contentType: /^multipart\/form-data; boundary=<boundary>/,
      });
      expect
        .soft(echo.parts?.map((part) => [part.name, part.value]))
        .toEqual(Object.entries(FORM_DATA_FIELDS));
    },
  },
  {
    scenario: 'fetch-post-blob',
    kind: 'http',
    assertApp: (result) =>
      expectEcho(result, { contentType: new RegExp(`^${BLOB_CONTENT_TYPE}`), body: BLOB_TEXT }),
  },
  {
    scenario: 'fetch-post-array-buffer',
    kind: 'http',
    assertApp: (result) =>
      expectEcho(result, {
        contentType: new RegExp(`^${ARRAY_BUFFER_CONTENT_TYPE}`),
        body: ARRAY_BUFFER_TEXT,
      }),
  },
  { scenario: 'fetch-abort', kind: 'http', assertApp: expectAborted },
  { scenario: 'fetch-timeout', kind: 'http', assertApp: expectAborted },
  {
    scenario: 'fetch-204',
    kind: 'http',
    assertApp: (result) => {
      expectResponse(result, 204);
      expect.soft(result.bodyLength).toBe(0);
    },
  },
  {
    scenario: 'fetch-redirect',
    kind: 'http',
    assertApp: (result) => {
      expectJsonFixture(result);
      expect.soft(result.url).toMatch(new RegExp(`${REDIRECT_TARGET}$`));
    },
  },
  {
    scenario: 'fetch-png',
    kind: 'http',
    assertApp: (result) => {
      expectResponse(result, 200);
      expect.soft(result.contentType).toBe('image/png');
      expect.soft(result.bodyLength).toBe(FIXTURE_PNG.byteLength);
      expect.soft(result.pngSignatureValid).toBe(true);
    },
  },
  {
    scenario: 'fetch-large-download',
    kind: 'http',
    assertApp: (result) => {
      expectResponse(result, 200);
      expect.soft(result.contentType).toBe('application/octet-stream');
      expect.soft(result.bodyLength).toBe(LARGE_BODY_SIZE);
      expect.soft(result.largeBodyPatternValid).toBe(true);
    },
  },
  {
    scenario: 'fetch-status-404',
    kind: 'http',
    assertApp: (result) => expectStatusFixture(result, 404),
  },
  {
    scenario: 'fetch-status-500',
    kind: 'http',
    assertApp: (result) => expectStatusFixture(result, 500),
  },
  {
    scenario: 'global-fetch-get-json',
    kind: 'http',
    // Which implementation `globalThis.fetch` is gets recorded in the
    // snapshot rather than asserted: it is the app's configuration, not the
    // plugin's behaviour.
    assertApp: (result) => {
      expectJsonFixture(result);
      expect.soft(result.globalFetch?.implementation).toBeDefined();
    },
  },
  { scenario: 'axios-get-json', kind: 'http', assertApp: expectJsonFixture },
  {
    scenario: 'axios-post-json',
    kind: 'http',
    assertApp: (result) =>
      expectEcho(result, {
        contentType: /^application\/json/,
        body: JSON.stringify(POST_JSON_PAYLOAD),
      }),
  },
  { scenario: 'expo-get-json', kind: 'http', assertApp: expectJsonFixture },
  { scenario: 'expo-abort', kind: 'http', assertApp: expectAborted },
  { scenario: 'nitro-get-json', kind: 'http', assertApp: expectJsonFixture },
  {
    scenario: 'nitro-post-json',
    kind: 'http',
    assertApp: (result) =>
      expectEcho(result, {
        contentType: /^application\/json/,
        body: JSON.stringify(POST_JSON_PAYLOAD),
      }),
  },
  { scenario: 'nitro-abort', kind: 'http', assertApp: expectAborted },
  {
    scenario: 'websocket-echo',
    kind: 'websocket',
    assertApp: (result) => {
      expect.soft(result.error).toBeUndefined();
      expect.soft(result.websocket).toMatchObject({
        sent: [...WEBSOCKET_MESSAGES],
        received: [...WEBSOCKET_MESSAGES],
        closeCode: 1000,
      });
    },
  },
  {
    scenario: 'sse-stream',
    kind: 'sse',
    assertApp: (result) => {
      expect.soft(result.error).toBeUndefined();
      expect.soft(result.sse).toEqual({
        opened: true,
        messages: SSE_EVENTS.filter((event) => event.event === 'message').map((e) => e.data),
        pings: SSE_EVENTS.filter((event) => event.event === 'ping').map((e) => e.data),
        errors: [],
        serverClosed: true,
      });
    },
  },
];

const config = readHarnessConfig();
let fixture: FixtureServer | undefined;
let harness: Harness | undefined;

beforeAll(async () => {
  fixture = await startFixtureServer({ port: config.fixturePort });
  harness = await openHarness(config);
  const mode = harness.observer.mode;

  if (config.record) {
    writeBaselineManifest({ platform: config.platform, observer: mode });
    return;
  }

  const manifest = readBaselineManifest(config.platform);
  if (!manifest) {
    throw new HarnessSetupError(
      `no baselines are recorded for platform "${config.platform}".`,
      'Record them with `pnpm --filter @rozenite/playground e2e:network:record` against the implementation to hold changes to.',
    );
  }
  if (manifest.observer !== mode) {
    throw new HarnessSetupError(
      `the plugin is being observed through "${mode}", but the ${config.platform} baselines were recorded through "${manifest.observer}".`,
      mode === 'agent-tools'
        ? "The tap stream no longer carries the plugin's messages (see the log above); that is a regression, not a reason to re-record."
        : 'Re-record the baselines only if the change of observer is intended.',
    );
  }
});

afterAll(async () => {
  await harness?.close();
  await fixture?.close();
});

describe.sequential('Network Activity on device', () => {
  it('covers every scenario the playground exposes', () => {
    expect(CASES.map((testCase) => testCase.scenario).sort()).toEqual(
      [...NETWORK_SCENARIO_NAMES].sort(),
    );
  });

  for (const testCase of CASES) {
    it(testCase.scenario, async () => {
      if (!harness) {
        throw new Error('The harness is not connected; see the beforeAll error above.');
      }
      const active = harness;

      const { mode, result, capture } = await active.observer.run({
        scenario: testCase.scenario,
        kind: testCase.kind,
        invoke: () => active.runScenario(testCase.scenario),
      });

      // `globalFetch` describes the app's configuration and can change when
      // the plugin wraps the global, so it is kept apart from what the app
      // observed.
      const { globalFetch, ...app } = result;
      const normalise = createNormaliser({ fixtureBaseUrl: config.fixtureBaseUrl });

      try {
        // 1. The plugin did not disturb the application.
        testCase.assertApp(result);
      } finally {
        // 2. The plugin's capture matches the recorded wire contract. Taken
        // even if an app-side check throws, so a record run keeps the baseline.
        expect({
          app: normalise(app),
          ...(globalFetch ? { globalFetch } : {}),
          capture: normalise(capture),
        }).toMatchSnapshot(mode);
      }
    });
  }
});
