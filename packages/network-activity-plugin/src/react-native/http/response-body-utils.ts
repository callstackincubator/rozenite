import type { HttpHeaders, HttpMethod, RequestPostData, ResponseBody } from '../../shared/client';
import { isJsonContentType, isXmlContentType } from '../../utils/getContentTypeMimeType';
import { getContentTypeMime } from '../../utils/getContentTypeMimeType';
import { getRequestBody, appendHeader } from './request-utils';

// Cap on binary capture. Above this, we ship a `binary-too-large` variant
// with just the size — no bytes cross the bridge. 5MB comfortably covers
// debug-relevant images while keeping the bridge from choking on outliers.
// nitro's own body/message capture uses a separate, smaller cap — see
// `nitro-fetch/nitro-network-inspector.ts`.
export const BINARY_CAPTURE_SIZE_CAP = 5 * 1024 * 1024;

const ARRAY_BUFFER_BASE64_CHUNK = 0x8000;

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';

  for (let i = 0; i < bytes.length; i += ARRAY_BUFFER_BASE64_CHUNK) {
    const chunk = bytes.subarray(i, i + ARRAY_BUFFER_BASE64_CHUNK);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }

  return btoa(binary);
};

export const isTextLikeContentType = (contentType?: string | null) => {
  if (!contentType) {
    return false;
  }

  return (
    contentType.startsWith('text/') ||
    isJsonContentType(contentType) ||
    isXmlContentType(contentType)
  );
};

export const captureResponseBodyFromBytes = (
  bytes: Uint8Array,
  contentType?: string | null,
): ResponseBody => {
  if (isTextLikeContentType(contentType)) {
    return new TextDecoder().decode(bytes);
  }

  if (bytes.byteLength > BINARY_CAPTURE_SIZE_CAP) {
    return { kind: 'binary-too-large', size: bytes.byteLength };
  }

  return { kind: 'binary', base64: bytesToBase64(bytes) };
};

export const captureResponseBodyFromArrayBuffer = async (
  buffer: ArrayBuffer | null,
  contentType?: string | null,
): Promise<ResponseBody> => {
  if (!buffer || buffer.byteLength === 0) {
    return null;
  }

  return captureResponseBodyFromBytes(new Uint8Array(buffer), contentType);
};

const readBlobAsArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

export const captureResponseBodyFromBlob = async (
  blob: Blob,
  contentType?: string | null,
): Promise<ResponseBody> => {
  if (blob.size > BINARY_CAPTURE_SIZE_CAP) {
    return { kind: 'binary-too-large', size: blob.size };
  }

  const buffer =
    typeof blob.arrayBuffer === 'function'
      ? await blob.arrayBuffer()
      : await readBlobAsArrayBuffer(blob);
  return captureResponseBodyFromBytes(new Uint8Array(buffer), contentType);
};

// --- fetch request/response normalization (used by the fetch hook) ---

export type FetchRequestLike = {
  url?: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  signal?: AbortSignal | null;
};

export type FetchInput = RequestInfo | URL | FetchRequestLike;

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

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    headers.forEach((value, key) => appendHeader(normalized, key, value));
    return normalized;
  }

  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => appendHeader(normalized, key, value));
    return normalized;
  }

  Object.entries(headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => appendHeader(normalized, key, item));
      return;
    }

    appendHeader(normalized, key, value);
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
  const request = typeof Request !== 'undefined' && input instanceof Request ? input : null;
  const requestLike =
    !request && typeof input === 'object' && input !== null ? (input as FetchRequestLike) : null;
  // Expo follows fetch's `init.headers ?? input.headers` semantics: supplying
  // init headers replaces inherited headers instead of merging them.
  const headers = normalizeHeaders(init.headers ?? request?.headers ?? requestLike?.headers);

  return {
    url: request?.url ?? requestLike?.url ?? input.toString(),
    method: (
      init.method ??
      request?.method ??
      requestLike?.method ??
      'GET'
    ).toUpperCase() as HttpMethod,
    headers,
    postData: normalizeFetchBody(init.body ?? requestLike?.body),
    signal: init.signal ?? request?.signal ?? requestLike?.signal ?? undefined,
  };
};

export const getFetchContentType = (response: Response): string => {
  const contentType = response.headers.get('content-type');
  return contentType ? (getContentTypeMime({ 'content-type': contentType }) ?? '') : '';
};

export const getFetchContentLength = (response: Response): number | undefined => {
  const contentLength = response.headers.get('content-length');

  if (!contentLength) {
    return undefined;
  }

  const parsed = Number.parseInt(contentLength, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

export const createProgressThrottler = (minIntervalMs = 100) => {
  let lastEmittedAt = 0;

  return (timestamp: number) => {
    if (lastEmittedAt === 0 || timestamp - lastEmittedAt >= minIntervalMs) {
      lastEmittedAt = timestamp;
      return true;
    }

    return false;
  };
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
