import { HttpHeaders, RequestPostData } from '../shared/client';
import { getHttpHeader } from './getHttpHeader';
import { inferContentTypeFromPostData } from './inferContentTypeFromPostData';

/**
 * Partially emulates React Native's behavior for setting HTTP headers.
 *
 * @see https://github.com/facebook/react-native/blob/de5093c88771977b58f7bec3f3ffa64a9595334e/packages/react-native/Libraries/Network/RCTNetworking.mm#L345-L349
 */
export function applyReactNativeRequestHeadersLogic(
  headers: HttpHeaders,
  postData?: RequestPostData
): HttpHeaders {
  const existingContentType = getHttpHeader(headers, 'content-type');

  if (existingContentType) {
    return headers;
  }

  const inferredContentType = inferContentTypeFromPostData(postData);

  if (!inferredContentType) {
    return headers;
  }

  return {
    ...headers,
    'Content-Type': inferredContentType,
  };
}
