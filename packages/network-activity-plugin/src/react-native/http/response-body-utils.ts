import type { ResponseBody } from '../../shared/client';
import {
  isJsonContentType,
  isXmlContentType,
} from '../../utils/getContentTypeMimeType';

// Cap on binary capture. Above this, we ship a `binary-too-large` variant
// with just the size — no bytes cross the bridge. 5MB comfortably covers
// debug-relevant images while keeping the bridge from choking on outliers.
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

  if (buffer.byteLength > BINARY_CAPTURE_SIZE_CAP) {
    return { kind: 'binary-too-large', size: buffer.byteLength };
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
