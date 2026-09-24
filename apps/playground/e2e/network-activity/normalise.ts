import { createHash } from 'node:crypto';

/**
 * Turns captured plugin traffic into something that can be snapshotted:
 * volatile values (ids, clocks, source positions, progress counts, a few
 * response headers) become stable tokens, everything else stays verbatim.
 * See docs/adr/0002-network-activity-on-device-regression-harness.md.
 */

export type NormaliseOptions = {
  /** Fixture origins as the device saw them; replaced with `<fixture>` / `<fixture-ws>`. */
  fixtureBaseUrl: string;
};

const NUMBER_TOKEN = '<number>';

/** Clock readings and anything derived from them. */
const TIMING_KEYS = new Set([
  'timestamp',
  'duration',
  'ttfb',
  'responseTime',
  'startTimeMs',
  'endTimeMs',
  'durationMs',
  'startedAt',
  'endedAt',
  'stoppedAt',
]);

/** Source positions inside an initiator; they move whenever any bundled file changes. */
const SOURCE_POSITION_KEYS = new Set([
  'lineNumber',
  'columnNumber',
  'generatedLineNumber',
  'generatedColumnNumber',
  'row',
  'column',
]);

const INITIATOR_URL_KEYS = new Set(['url', 'generatedUrl', 'fileName']);

/**
 * Initiator stacks keep only their first frames: the frames below the
 * caller depend on how deep the interception sits, which is exactly what a
 * capture rewrite changes.
 */
export const MAX_INITIATOR_STACK_FRAMES = 3;

/** Response headers that change per request or per connection. */
export const VOLATILE_RESPONSE_HEADERS = new Set([
  'date',
  'etag',
  'last-modified',
  'age',
  'connection',
  'keep-alive',
]);

/** Longer strings (large bodies) are replaced with their length and hash. */
export const MAX_VERBATIM_STRING_LENGTH = 4096;

const ID_KEY_PREFIXES = new Map([
  ['requestId', 'request'],
  ['socketId', 'socket'],
]);

/** Bundle URLs name the Metro host and port, which differ between machines. */
const maskOrigin = (value: string): string =>
  value.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '<metro>');

const stripQuery = (value: string): string => {
  const index = value.indexOf('?');
  return index < 0 ? value : `${value.slice(0, index)}?<query>`;
};

const summariseLongString = (value: string): string => {
  const digest = createHash('sha256').update(value).digest('hex').slice(0, 16);
  return `<string length=${value.length} sha256=${digest}>`;
};

export type Normaliser = <T>(value: T) => unknown;

/**
 * Creates a normaliser whose id tokens are shared across every value it is
 * given, so the same request id maps to the same token throughout a test.
 */
export const createNormaliser = ({ fixtureBaseUrl }: NormaliseOptions): Normaliser => {
  const httpOrigin = fixtureBaseUrl.replace(/\/+$/, '');
  const wsOrigin = httpOrigin.replace(/^http/, 'ws');
  const tokens = new Map<string, Map<string, string>>();

  const tokenFor = (kind: string, value: string): string => {
    let byValue = tokens.get(kind);
    if (!byValue) {
      byValue = new Map();
      tokens.set(kind, byValue);
    }
    let token = byValue.get(value);
    if (!token) {
      token = `<${kind}-${byValue.size + 1}>`;
      byValue.set(value, token);
    }
    return token;
  };

  const normaliseString = (value: string): string => {
    const replaced = value
      .split(wsOrigin)
      .join('<fixture-ws>')
      .split(httpOrigin)
      .join('<fixture>')
      .replace(/boundary=("?)[^";\s]+\1/gi, 'boundary=<boundary>');
    return replaced.length > MAX_VERBATIM_STRING_LENGTH ? summariseLongString(replaced) : replaced;
  };

  type Context = { key?: string; inInitiator: boolean; inResponse: boolean; inMessages: boolean };

  const walk = (value: unknown, ctx: Context): unknown => {
    const { key } = ctx;

    if (typeof value === 'number') {
      if (key && TIMING_KEYS.has(key)) {
        return NUMBER_TOKEN;
      }
      if (key && ctx.inInitiator && SOURCE_POSITION_KEYS.has(key)) {
        return NUMBER_TOKEN;
      }
      return value;
    }

    if (typeof value === 'string') {
      const idPrefix = key ? ID_KEY_PREFIXES.get(key) : undefined;
      if (idPrefix) {
        return tokenFor(idPrefix, value);
      }
      if (key === 'id' && ctx.inMessages) {
        return tokenFor('message', value);
      }
      if (key && ctx.inInitiator && INITIATOR_URL_KEYS.has(key)) {
        return normaliseString(maskOrigin(stripQuery(value)));
      }
      return normaliseString(value);
    }

    if (Array.isArray(value)) {
      const items =
        key === 'stack' && ctx.inInitiator ? value.slice(0, MAX_INITIATOR_STACK_FRAMES) : value;
      return items.map((item) => walk(item, { ...ctx, key: undefined }));
    }

    if (value && typeof value === 'object') {
      if (key === 'codeFrame' && ctx.inInitiator) {
        const frame = value as { fileName?: unknown; location?: unknown };
        return {
          content: '<code-frame>',
          ...(typeof frame.fileName === 'string'
            ? { fileName: normaliseString(maskOrigin(stripQuery(frame.fileName))) }
            : {}),
          ...(frame.location ? { location: '<location>' } : {}),
        };
      }

      const dropVolatileHeaders = key === 'headers' && ctx.inResponse;
      const output: Record<string, unknown> = {};

      for (const [childKey, childValue] of Object.entries(value)) {
        if (dropVolatileHeaders && VOLATILE_RESPONSE_HEADERS.has(childKey.toLowerCase())) {
          continue;
        }

        output[childKey] = walk(childValue, {
          key: childKey,
          inInitiator: ctx.inInitiator || childKey === 'initiator',
          inResponse: ctx.inResponse || childKey === 'response',
          inMessages: ctx.inMessages || childKey === 'messages',
        });
      }

      return output;
    }

    return value;
  };

  return (value) => walk(value, { inInitiator: false, inResponse: false, inMessages: false });
};

export type CapturedEvent = {
  type: string;
  payload: unknown;
};

type ProgressPayload = {
  requestId?: unknown;
  loaded?: unknown;
  total?: unknown;
  lengthComputable?: unknown;
  source?: unknown;
};

/**
 * Collapses every request's `request-progress` events into one entry, placed
 * where the first one was. How many progress events fire depends on how the
 * bytes were chunked on the way in, so the count becomes a token; the final
 * `loaded`/`total` are kept.
 */
export const collapseProgressEvents = (events: CapturedEvent[]): CapturedEvent[] => {
  const lastProgress = new Map<unknown, ProgressPayload>();
  for (const event of events) {
    if (event.type === 'request-progress') {
      const payload = (event.payload ?? {}) as ProgressPayload;
      lastProgress.set(payload.requestId, payload);
    }
  }

  const emitted = new Set<unknown>();
  const collapsed: CapturedEvent[] = [];

  for (const event of events) {
    if (event.type !== 'request-progress') {
      collapsed.push(event);
      continue;
    }

    const requestId = ((event.payload ?? {}) as ProgressPayload).requestId;
    if (emitted.has(requestId)) {
      continue;
    }
    emitted.add(requestId);

    const last = lastProgress.get(requestId) ?? {};
    collapsed.push({
      type: 'request-progress',
      payload: {
        requestId,
        collapsedEvents: '<count>',
        loaded: last.loaded,
        total: last.total,
        lengthComputable: last.lengthComputable,
        ...(last.source !== undefined ? { source: last.source } : {}),
      },
    });
  }

  return collapsed;
};
