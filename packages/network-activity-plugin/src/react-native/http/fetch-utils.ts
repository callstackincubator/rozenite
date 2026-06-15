import type {
  HttpHeaders,
  HttpMethod,
  RequestPostData,
  ResponseBody,
} from '../../shared/client';
import { getRequestBody } from './http-utils';
import { captureResponseBodyFromBytes } from './response-body-utils';
import { getContentTypeMime } from '../../utils/getContentTypeMimeType';
export { BINARY_CAPTURE_SIZE_CAP } from './response-body-utils';

export type FetchInput = RequestInfo | URL;

export type NormalizedFetchRequest = {
  url: string;
  method: HttpMethod;
  headers: HttpHeaders;
  postData: RequestPostData;
  signal?: AbortSignal;
};

export const normalizeHeaders = (headers?: HeadersInit): HttpHeaders => {
  const normalized: HttpHeaders = {};

  if (!headers) {
    return normalized;
  }

  const assign = (key: string, value: string) => {
    const existing = normalized[key];

    if (existing === undefined) {
      normalized[key] = value;
      return;
    }

    normalized[key] = Array.isArray(existing)
      ? [...existing, value]
      : [existing, value];
  };

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      assign(key, value);
    });
    return normalized;
  }

  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      assign(key, value);
    });
    return normalized;
  }

  Object.entries(headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => assign(key, item));
      return;
    }

    assign(key, value);
  });

  return normalized;
};

const normalizeFetchBody = (body?: BodyInit | null): RequestPostData => {
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
    return undefined;
  }

  if (body instanceof URLSearchParams) {
    return getRequestBody(body.toString());
  }

  return getRequestBody(body as RequestPostData);
};

export const normalizeFetchRequest = (
  input: FetchInput,
  init: RequestInit = {},
): NormalizedFetchRequest => {
  const request = input instanceof Request ? input : null;
  const headers = {
    ...normalizeHeaders(request?.headers),
    ...normalizeHeaders(init.headers),
  };

  return {
    url: request?.url ?? input.toString(),
    method: (init.method ?? request?.method ?? 'GET').toUpperCase() as HttpMethod,
    headers,
    postData: normalizeFetchBody(init.body),
    signal: init.signal ?? request?.signal,
  };
};

export const getFetchResponseHeaders = (response: Response): HttpHeaders => {
  return normalizeHeaders(response.headers);
};

export const getFetchContentType = (response: Response): string => {
  const contentType = response.headers.get('content-type');
  return contentType
    ? getContentTypeMime({ 'content-type': contentType }) ?? ''
    : '';
};

export const getFetchContentLength = (
  response: Response,
): number | undefined => {
  const contentLength = response.headers.get('content-length');

  if (!contentLength) {
    return undefined;
  }

  const parsed = Number.parseInt(contentLength, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

export const createProgressThrottler = (minIntervalMs = 100) => {
  let lastEmittedAt = 0;

  return (timestamp: number, force = false) => {
    if (
      force ||
      lastEmittedAt === 0 ||
      timestamp - lastEmittedAt >= minIntervalMs
    ) {
      lastEmittedAt = timestamp;
      return true;
    }

    return false;
  };
};

export const captureFetchResponseBodyFromBytes = async (
  bytes: Uint8Array,
  contentType: string,
): Promise<ResponseBody> => {
  return captureResponseBodyFromBytes(bytes, contentType);
};

export const isFetchAbortError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const { name, message } = error as { name?: string; message?: string };

  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    message?.toLowerCase().includes('aborted') === true
  );
};
