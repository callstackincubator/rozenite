import { HttpHeaders } from "../../shared/client";

// Utility to get header value case-insensitively
export function getHttpHeaderValue(headers: HttpHeaders, name: string) {
  const lowerName = name.toLowerCase();

  for (const key in headers) {
    if (key.toLowerCase() === lowerName) {
      return headers[key];
    }
  }
  
  return undefined;
}
