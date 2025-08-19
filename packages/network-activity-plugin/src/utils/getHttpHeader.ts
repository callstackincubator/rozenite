import { HttpHeaders, XHRHeaders } from '../shared/client';

// Utility to get header value and actual key case-insensitively
export function getHttpHeader<T extends HttpHeaders | XHRHeaders>(
  headers: T,
  name: string
) {
  const lowerName = name.toLowerCase();

  for (const key in headers) {
    if (key.toLowerCase() === lowerName) {
      return { value: headers[key], originalKey: key };
    }
  }

  return undefined;
}
