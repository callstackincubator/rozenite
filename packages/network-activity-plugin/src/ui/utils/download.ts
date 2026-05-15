import type { HttpHeaders } from '../../shared/client';

// Decode a base64 string to a Uint8Array via `atob`. Mirrors the
// chunking concern on the encode side: atob produces a binary string,
// each char is one byte, we re-pack into a typed array byte by byte.
export const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const base64ToBlob = (base64: string, contentType: string): Blob => {
  // Allocate the ArrayBuffer up front so the Uint8Array is known to
  // be ArrayBuffer-backed (not SharedArrayBuffer); satisfies the
  // BlobPart constraint without a cast.
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return new Blob([buffer], {
    type: contentType || 'application/octet-stream',
  });
};

// Fallback extension when neither Content-Disposition nor URL gives us
// a usable filename. Map a few common content-types so saved files open
// in the right tool; everything else lands as `.bin`.
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/gzip': 'gz',
  'application/json': 'json',
  'application/xml': 'xml',
  'application/javascript': 'js',
  'application/octet-stream': 'bin',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'text/html': 'html',
  'text/plain': 'txt',
  'text/css': 'css',
  'text/csv': 'csv',
};

const extensionForContentType = (contentType: string): string => {
  // Strip parameters: "text/html; charset=utf-8" → "text/html".
  const bare = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return CONTENT_TYPE_EXTENSIONS[bare] ?? 'bin';
};

export const readHeader = (
  headers: HttpHeaders | undefined,
  name: string,
): string | undefined => {
  if (!headers) return undefined;
  const lowerTarget = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerTarget) {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return undefined;
};

// RFC 6266: `Content-Disposition: attachment; filename="report.pdf"`
// or `filename*=UTF-8''report%20with%20space.pdf`. We only extract the
// raw value here; downstream callers can sanitize further if they care
// about path traversal etc. (irrelevant for the playground / debug use
// case but worth knowing).
const parseContentDispositionFilename = (
  header: string | undefined,
): string | undefined => {
  if (!header) return undefined;
  // Prefer RFC 5987 `filename*` over the legacy `filename` when both
  // are present — it has a stricter encoding contract.
  const extended = /filename\*\s*=\s*[^']*''([^;]+)/i.exec(header);
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1].trim()) || undefined;
    } catch {
      // Fall through to the unencoded form.
    }
  }
  const basic = /filename\s*=\s*("([^"]*)"|([^;]+))/i.exec(header);
  const value = basic?.[2] ?? basic?.[3];
  return value?.trim() || undefined;
};

const filenameFromUrl = (url: string): string | undefined => {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    return last && last.length > 0 ? last : undefined;
  } catch {
    return undefined;
  }
};

// Three-tier filename derivation:
//   1. Content-Disposition filename (RFC 5987 → RFC 6266)
//   2. Last path segment of the response URL
//   3. `response.<ext>` where the extension comes from a small
//      Content-Type → extension map (everything unknown becomes `.bin`)
export const deriveFilename = ({
  headers,
  url,
  contentType,
}: {
  headers?: HttpHeaders;
  url: string;
  contentType: string;
}): string => {
  const fromDisposition = parseContentDispositionFilename(
    readHeader(headers, 'Content-Disposition'),
  );
  if (fromDisposition) return fromDisposition;

  const fromUrl = filenameFromUrl(url);
  if (fromUrl) return fromUrl;

  return `response.${extensionForContentType(contentType)}`;
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Defer revoke a tick so Safari's download pipeline doesn't drop
  // the request when the URL disappears mid-click.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};
