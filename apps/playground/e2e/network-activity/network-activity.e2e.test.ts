/**
 * On-device regression suite for @rozenite/network-activity-plugin
 * (docs/adr/0002-network-activity-on-device-regression-harness.md).
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
import { openHarness, readHarnessConfig, type Harness } from './harness';
import { createNormaliser } from './normalise';
import type { CaptureKind } from './observers';

type ScenarioCase = {
  scenario: NetworkScenarioName;
  kind: CaptureKind;
  assertApp: (result: NetworkScenarioResult) => void;
};

const expectResponse = (result: NetworkScenarioResult, status: number) => {
  expect(result.error, `${result.scenario} should not fail in the app`).toBeUndefined();
  expect(result.status).toBe(status);
  expect(result.echoedScenarioHeader).toBe(result.scenario);
};

const expectJsonFixture = (result: NetworkScenarioResult) => {
  expectResponse(result, 200);
  expect(result.contentType).toMatch(/^application\/json/);
  expect(result.json).toEqual(FIXTURE_JSON);
};

const expectEcho = (
  result: NetworkScenarioResult,
  expected: { contentType: RegExp; body?: string },
): EchoResponse => {
  expectResponse(result, 200);
  const echo = result.json as EchoResponse;
  expect(echo.method).toBe('POST');
  expect(echo.path).toBe('/echo');
  expect(echo.headers['x-rozenite-scenario']).toBe(result.scenario);
  expect(echo.contentType).toMatch(expected.contentType);
  if (expected.body !== undefined) {
    expect(echo.body).toBe(expected.body);
    expect(echo.bodyLength).toBe(Buffer.byteLength(expected.body));
  }
  return echo;
};

/** Built-in fetch rejects with `AbortError`; expo/fetch wraps it in a `FetchError`. */
const expectAborted = (result: NetworkScenarioResult) => {
  expect(result.status, `${result.scenario} should not produce a response`).toBeUndefined();
  expect(result.error).toBeDefined();
  expect(`${result.error?.name}: ${result.error?.message}`).toMatch(/abort|cancel|timeout/i);
};

const expectStatusFixture = (result: NetworkScenarioResult, status: number) => {
  expectResponse(result, status);
  expect(result.json).toMatchObject({ status });
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
      expect(echo.parts?.map((part) => [part.name, part.value])).toEqual(
        Object.entries(FORM_DATA_FIELDS),
      );
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
      expect(result.bodyLength).toBe(0);
    },
  },
  {
    scenario: 'fetch-redirect',
    kind: 'http',
    assertApp: (result) => {
      expectJsonFixture(result);
      expect(result.url).toMatch(new RegExp(`${REDIRECT_TARGET}$`));
    },
  },
  {
    scenario: 'fetch-png',
    kind: 'http',
    assertApp: (result) => {
      expectResponse(result, 200);
      expect(result.contentType).toBe('image/png');
      expect(result.bodyLength).toBe(FIXTURE_PNG.byteLength);
      expect(result.pngSignatureValid).toBe(true);
    },
  },
  {
    scenario: 'fetch-large-download',
    kind: 'http',
    assertApp: (result) => {
      expectResponse(result, 200);
      expect(result.contentType).toBe('application/octet-stream');
      expect(result.bodyLength).toBe(LARGE_BODY_SIZE);
      expect(result.largeBodyPatternValid).toBe(true);
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
      expect(result.error).toBeUndefined();
      expect(result.websocket).toMatchObject({
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
      expect(result.error).toBeUndefined();
      expect(result.sse).toEqual({
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

      // 1. The plugin did not disturb the application.
      testCase.assertApp(result);

      // 2. The plugin's capture matches the recorded wire contract.
      const normalise = createNormaliser({ fixtureBaseUrl: config.fixtureBaseUrl });
      expect({ app: normalise(result), capture: normalise(capture) }).toMatchSnapshot(mode);
    });
  }
});
