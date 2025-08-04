import { ReactNativeFormData, RequestPostData } from '../../shared/client';
import { escapeShellArg } from './escapeShellArg';
import { getHttpHeaderValue } from './getHttpHeaderValue';

const BASE_TAB_INDENT = 2; // Number of spaces for indentation

function stringifyData(postData: RequestPostData): string {
  try {
    const jsonString = JSON.stringify(typeof postData === 'string' ? JSON.parse(postData) : postData, null, BASE_TAB_INDENT * 4);

    return jsonString.replace(/([}\]])$/, '$1'.padStart(BASE_TAB_INDENT * 2));
  } catch {
    return String(postData);
  }
}

function detectPostDataType(postData: RequestPostData) {
  if (postData === null || postData === undefined) return 'empty';
  
  if (typeof postData === 'object' && '_parts' in postData && Array.isArray(postData._parts)) {
    return 'formdata';
  }

  return 'unknown';
}

// Adds a curl parameter with proper indentation
function addCurlParam(curlParts: string[], flag: string, value: string): void {
  curlParts.push(`${flag.padStart(BASE_TAB_INDENT + flag.length)} ${value}`);
}

function addHttpMethodToCurl(curlParts: string[], method: string): void {
  if (method && isPostRequest(method)) {
    addCurlParam(curlParts, '-X', method.toUpperCase());
  }
}

function addHeadersToCurl(curlParts: string[], headers: Record<string, string>): void {
  Object.entries(headers).forEach(([key, value]) => {
    addCurlParam(curlParts, '-H', escapeShellArg(`${key}: ${value}`));
  });
}

function isPostRequest(method: string): boolean {
  return method.toLowerCase() !== 'get';
}

function addBodyToCurl(curlParts: string[], postData: RequestPostData, headers: Record<string, string>): void {
  const contentType = getHttpHeaderValue(headers, 'content-type');
  const dataType = detectPostDataType(postData);

  console.log(postData, contentType, dataType, typeof postData);

  if (dataType === 'empty') {
    return;
  }

  // Special case for React Native FormData
  if (dataType === 'formdata' && contentType?.includes('multipart/form-data')) {
    const formParts = (postData as ReactNativeFormData)._parts.map(([key, value]) => `${key}=${value}`);

    formParts.forEach(part => addCurlParam(curlParts, '--form', escapeShellArg(part)));

    return;
  }

  addCurlParam(curlParts, '--data-raw', escapeShellArg(stringifyData(postData)));
}

export function generateCurlCommand(request: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  postData?: RequestPostData;
}): string {
  const { method, url, headers = {}, postData } = request;
  
  const curlParts: string[] = [`curl ${escapeShellArg(url)}`];
  
  addHttpMethodToCurl(curlParts, method);
  addHeadersToCurl(curlParts, headers);
  
  if (postData && isPostRequest(method)) {
    addBodyToCurl(curlParts, postData, headers);
  }
  
  return curlParts.join(' \\\n');
}
