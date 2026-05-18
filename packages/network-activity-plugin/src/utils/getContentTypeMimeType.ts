import { HttpHeaders } from '../shared/client';
import { getHttpHeader } from './getHttpHeader';

export function normalizeContentType(contentType: string) {
  return contentType.split(';')[0].trim().toLowerCase();
}

export function getContentTypeMime(headers: HttpHeaders) {
  const contentType = getHttpHeader(headers, 'content-type');

  if (!contentType) {
    return undefined;
  }

  const { value } = contentType;

  // Content-Type can't be an array, but if it does we simply get the first element.
  const actualValue = Array.isArray(value) ? value[0] : value;

  return actualValue.split(';')[0].trim();
}

export function isJsonContentType(contentType: string | null | undefined) {
  if (!contentType) {
    return false;
  }

  const mimeType = normalizeContentType(contentType);

  return mimeType === 'application/json' || mimeType.endsWith('+json');
}

export function isXmlContentType(contentType: string | null | undefined) {
  if (!contentType) {
    return false;
  }

  const mimeType = normalizeContentType(contentType);

  return (
    mimeType === 'application/xml' ||
    mimeType === 'text/xml' ||
    mimeType.endsWith('+xml')
  );
}
