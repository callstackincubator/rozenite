import { HttpHeaders } from '../shared/client';
import { getHttpHeaderValue } from './getHttpHeaderValue';

export function getContentTypeMime(headers: HttpHeaders) {
  const contentType = getHttpHeaderValue(headers, 'content-type');

  if (contentType) {
    return contentType.split(';')[0].trim();
  }

  return undefined;
}
