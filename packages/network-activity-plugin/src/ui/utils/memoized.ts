// The request list is rebuilt from every request on every update, so what it derives from a
// request that never changes (the clock time it started at, the parts of its URL) is worked out
// once and remembered. The caches are bounded, and just emptied when they fill up.

const MAX_CACHED_ENTRIES = 5000;

const remember = <Key, Value>(cache: Map<Key, Value>, key: Key, compute: () => Value): Value => {
  const cached = cache.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const value = compute();

  if (cache.size >= MAX_CACHED_ENTRIES) {
    cache.clear();
  }

  cache.set(key, value);

  return value;
};

// `toLocaleTimeString` builds a formatter on every call; one shared formatter is far cheaper.
const clockFormatter = new Intl.DateTimeFormat('en-US', {
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const startTimes = new Map<number, string>();

/** The clock time with milliseconds a request started at, like `14:05:09.042`. */
export const formatClockTime = (timestamp: number): string =>
  remember(startTimes, timestamp, () => {
    const milliseconds = new Date(timestamp).getMilliseconds().toString().padStart(3, '0');

    return `${clockFormatter.format(timestamp)}.${milliseconds}`;
  });

export type ParsedUrl = {
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
  port: string;
};

const parsedUrls = new Map<string, ParsedUrl | null>();

/** The parts of a URL, or `null` when it does not parse. */
export const parseUrl = (url: string): ParsedUrl | null => {
  const cached = parsedUrls.get(url);

  if (cached !== undefined) {
    return cached;
  }

  let parsed: ParsedUrl | null;

  try {
    const { hostname, pathname, search, hash, port } = new URL(url);
    parsed = { hostname, pathname, search, hash, port };
  } catch {
    parsed = null;
  }

  if (parsedUrls.size >= MAX_CACHED_ENTRIES) {
    parsedUrls.clear();
  }

  parsedUrls.set(url, parsed);

  return parsed;
};
