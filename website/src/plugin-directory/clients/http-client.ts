// The one HTTP client behind the plugin directory. Requests are keyed by URL, so every caller of
// the same URL shares a single request: concurrent callers share the in-flight promise and a
// successful result is reused for the rest of the process. A failure is evicted, so a later
// caller retries. Headers are fixed per call site and are not part of the key.

const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 10_000;

/**
 * A failed request. `status` is undefined for network errors, timeouts and unusable payloads.
 * The message names the URL and the status only: request headers carry the GitHub token and must
 * never end up in an error or a log line.
 */
export class HttpError extends Error {
  readonly url: string;
  readonly status: number | undefined;

  constructor(message: string, url: string, status?: number) {
    super(message);
    this.name = 'HttpError';
    this.url = url;
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// `Retry-After` in seconds, capped; anything else (absent, an HTTP date, garbage) falls back to
// the default delay.
const getRetryDelay = (retryAfter: string | null): number => {
  if (retryAfter === null || !/^\d+$/.test(retryAfter.trim())) {
    return DEFAULT_RETRY_DELAY_MS;
  }
  return Math.min(Number(retryAfter.trim()) * 1000, MAX_RETRY_DELAY_MS);
};

// A network failure, with the underlying error code (ENOTFOUND, ECONNRESET, ...) when there is one.
const describeNetworkError = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return 'unknown error';
  }
  const code = (error.cause as { code?: unknown } | undefined)?.code;
  const detail = `${error.name}: ${error.message}`;
  return typeof code === 'string' ? `${detail} [${code}]` : detail;
};

// GitHub signals rate limiting with a 403 or 429 that carries `x-ratelimit-remaining: 0` or
// `retry-after`. Only the interpretation is reported, never the header values.
const isRateLimited = (response: Response): boolean =>
  (response.status === 403 || response.status === 429) &&
  (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after'));

const request = async (url: string, headers: Record<string, string>): Promise<unknown> => {
  for (let attempt = 1; ; attempt++) {
    const canRetry = attempt === 1;
    let response: Response;

    try {
      response = await fetch(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      if (canRetry) {
        await sleep(DEFAULT_RETRY_DELAY_MS);
        continue;
      }
      throw new HttpError(`GET ${url} failed (${describeNetworkError(error)})`, url);
    }

    if (response.ok) {
      try {
        return await response.json();
      } catch {
        throw new HttpError(`GET ${url} returned a body that is not JSON`, url, response.status);
      }
    }

    // Release the connection; the body of an error response is not used.
    await response.body?.cancel().catch(() => undefined);

    const retryable =
      response.status === 429 ||
      response.status >= 500 ||
      (response.status === 403 && response.headers.has('retry-after'));

    if (canRetry && retryable) {
      await sleep(getRetryDelay(response.headers.get('retry-after')));
      continue;
    }

    const limited = isRateLimited(response) ? ', rate limited' : '';
    throw new HttpError(
      `GET ${url} failed with status ${response.status}${limited}`,
      url,
      response.status,
    );
  }
};

const results = new Map<string, Promise<unknown>>();

export const getJson = <T>(url: string, headers: Record<string, string> = {}): Promise<T> => {
  const existing = results.get(url);
  if (existing) {
    return existing as Promise<T>;
  }

  const pending = request(url, headers).catch((error: unknown) => {
    results.delete(url);
    throw error;
  });
  results.set(url, pending);

  return pending as Promise<T>;
};
