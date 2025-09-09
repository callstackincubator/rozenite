import { generateMultipartBody } from './generateMultipartBody';
import {
  HttpNetworkEntry,
  HttpRequestData,
  SSENetworkEntry,
} from '../state/model';
import { getHttpHeaderValueAsString } from '../../utils/getHttpHeaderValueAsString';
import { HttpHeaders, XHRHeaders } from '../../shared/client';

const processHeaders = (requestHeaders: HttpHeaders | undefined) => {
  const headers: XHRHeaders = {};

  if (!requestHeaders) {
    return headers;
  }

  Object.entries(requestHeaders).forEach(([name, value]) => {
    // Filter out HTTP/2 pseudo-headers
    if (!name.startsWith(':')) {
      headers[name] = getHttpHeaderValueAsString(value);
    }
  });

  return headers;
};

const processRequestBody = (body: HttpRequestData, headers: XHRHeaders) => {
  const { type, value } = body.data;

  switch (type) {
    case 'text':
      return value;

    case 'form-data': {
      const { body, contentType } = generateMultipartBody(value);

      headers['Content-Type'] = contentType;

      return body;
    }

    default:
      return undefined;
  }
};

export const generateFetchCall = (
  request: HttpNetworkEntry | SSENetworkEntry
) => {
  const { url, headers: requestHeaders, method, body } = request.request;

  const headers = processHeaders(requestHeaders);
  const requestBody = body ? processRequestBody(body, headers) : undefined;

  const fetchOptions: RequestInit = {
    headers: Object.keys(headers).length ? headers : undefined,
    body: requestBody,
    method,
  };

  const options = JSON.stringify(fetchOptions, null, 2);

  return `fetch(${JSON.stringify(url)}, ${options});`;
};
