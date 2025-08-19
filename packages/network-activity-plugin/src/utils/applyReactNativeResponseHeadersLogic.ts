import { HttpHeaders, XHRHeaders } from '../shared/client';
import { splitSetCookieHeaderByComma } from './cookieParser';
import { getHttpHeader } from './getHttpHeader';

/**
 * Applies React Native specific logic to response headers.
 * React Native concatenates multiple header values into single strings,
 * this function parses them back into arrays where appropriate.
 * 
 * See:
 * https://github.com/facebook/react-native/blob/588f0c5ce6c283f116228456da2170d2adc3cbf4/ReactAndroid/src/main/java/com/facebook/react/modules/network/NetworkingModule.java#L637
 */
export const applyReactNativeResponseHeadersLogic = (
  headers: XHRHeaders
): HttpHeaders => {
  const parsedHeaders: HttpHeaders = { ...headers };

  const setCookieHeader = getHttpHeader(headers, 'set-cookie');

  if (setCookieHeader) {
    const { value, originalKey } = setCookieHeader;

    const cookies = splitSetCookieHeaderByComma(value);

    parsedHeaders[originalKey] = cookies.length > 0 ? cookies : value;
  }

  return parsedHeaders;
};
