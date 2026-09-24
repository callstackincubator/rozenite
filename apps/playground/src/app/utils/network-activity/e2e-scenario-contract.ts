/**
 * The contract between the playground's `app.run-network-scenario` agent tool
 * and the Node suite in `apps/playground/e2e/network-activity`. It has no
 * imports on purpose: the Node suite imports it too, and it must not drag
 * React Native modules into Node.
 *
 * See docs/adr/0002-network-activity-on-device-regression-harness.md.
 */

export const NETWORK_SCENARIO_TOOL_NAME = 'run-network-scenario';

/** Every scenario request carries this header so events can be correlated. */
export const SCENARIO_HEADER = 'X-Rozenite-Scenario';

/** WebSocket events carry no request headers; the socket URL carries this instead. */
export const SCENARIO_QUERY_PARAM = 'scenario';

/**
 * Scenarios the suite snapshots.
 *
 * `fetch-*` scenarios call `whatwg-fetch` directly: that is React Native's own
 * `fetch`, built on `XMLHttpRequest`. The app cannot reach it through
 * `globalThis.fetch`, because importing `expo` swaps the global for
 * `expo/fetch` (expo/src/winter/runtime.native.ts) unless
 * `EXPO_PUBLIC_USE_RN_FETCH` is set. `global-fetch-get-json` calls whatever
 * `globalThis.fetch` is and reports which implementation that was.
 */
export const NETWORK_SCENARIO_NAMES = [
  'fetch-get-json',
  'fetch-post-json',
  'fetch-post-form-data',
  'fetch-post-blob',
  'fetch-post-array-buffer',
  'fetch-abort',
  'fetch-timeout',
  'fetch-204',
  'fetch-redirect',
  'fetch-png',
  'fetch-large-download',
  'fetch-status-404',
  'fetch-status-500',
  'global-fetch-get-json',
  'axios-get-json',
  'axios-post-json',
  'expo-get-json',
  'expo-abort',
  'nitro-get-json',
  'nitro-post-json',
  'nitro-abort',
  'websocket-echo',
  'sse-stream',
] as const;

/** Scenarios the harness uses for its own checks; never snapshotted. */
export const HARNESS_SCENARIO_NAMES = ['fixture-ping'] as const;

export const ALL_SCENARIO_NAMES = [...NETWORK_SCENARIO_NAMES, ...HARNESS_SCENARIO_NAMES] as const;

export type NetworkScenarioName = (typeof NETWORK_SCENARIO_NAMES)[number];
export type ScenarioName = (typeof ALL_SCENARIO_NAMES)[number];

export const isScenarioName = (value: unknown): value is ScenarioName =>
  typeof value === 'string' && (ALL_SCENARIO_NAMES as readonly string[]).includes(value);

export type NetworkScenarioArgs = {
  scenario: ScenarioName;
  /** Fixture server origin as seen from the device, e.g. `http://localhost:38383`. */
  baseUrl: string;
};

/** How long `fixture-ping` waits for the fixture before reporting it unreachable. */
export const FIXTURE_PING_TIMEOUT_MS = 3000;

/** Bodies the scenarios send, so the suite can compare them with the echo. */
export const POST_JSON_PAYLOAD = {
  title: 'Rozenite e2e',
  count: 3,
  tags: ['network', 'activity'],
  nested: { ok: true },
} as const;

export const FORM_DATA_FIELDS = {
  name: 'Rozenite',
  note: 'form-data scenario',
} as const;

export const BLOB_TEXT = 'blob body from the playground';
export const BLOB_CONTENT_TYPE = 'text/plain';

export const ARRAY_BUFFER_TEXT = 'array buffer body from the playground';
export const ARRAY_BUFFER_CONTENT_TYPE = 'application/octet-stream';

export const WEBSOCKET_MESSAGES = ['hello-1', 'hello-2'] as const;

/** `/slow` delay requested by the abort and timeout scenarios. */
export const SLOW_RESPONSE_MS = 5000;
export const ABORT_AFTER_MS = 100;
export const TIMEOUT_AFTER_MS = 300;

/** What the application observed. Every field is JSON-serialisable. */
export type NetworkScenarioResult = {
  scenario: ScenarioName;
  /** `fetch` is whatwg-fetch over XHR (also `fixture-ping`); `global-fetch` is whatever `globalThis.fetch` is. */
  transport: 'fetch' | 'global-fetch' | 'axios' | 'expo' | 'nitro' | 'websocket' | 'sse';
  /** `Platform.OS`; reported by `fixture-ping`. */
  platform?: string;
  /**
   * Which implementation `globalThis.fetch` was; reported by
   * `global-fetch-get-json`. Only uses hints that survive the plugin wrapping
   * the global (no identity checks): whatwg-fetch marks its function with
   * `polyfill = true`.
   */
  globalFetch?: {
    implementation: 'whatwg-fetch' | 'other';
    hasPolyfillFlag: boolean;
    name: string;
  };
  status?: number;
  statusText?: string;
  contentType?: string | null;
  url?: string;
  redirected?: boolean;
  /** Length of the raw body read as text or bytes, when the scenario read it raw. */
  bodyLength?: number;
  /** Parsed JSON body, when the scenario read it with `.json()` or axios. */
  json?: unknown;
  text?: string;
  /** Headers the fixture echoed back under `x-rozenite-*`. */
  echoedScenarioHeader?: string | null;
  pngSignatureValid?: boolean;
  largeBodyPatternValid?: boolean;
  error?: { name: string; message: string };
  timeoutMechanism?: 'AbortSignal.timeout' | 'manual-abort';
  websocket?: {
    sent: string[];
    received: string[];
    closeCode: number | null;
    closeReason: string | null;
    wasClean: boolean | null;
  };
  sse?: {
    opened: boolean;
    messages: string[];
    pings: string[];
    errors: string[];
    serverClosed: boolean;
  };
};
