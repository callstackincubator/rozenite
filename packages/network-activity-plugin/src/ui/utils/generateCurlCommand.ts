import { RequestPostData } from '../../shared/client';
import { escapeShellArg } from './escapeShellArg';

const BASE_TAB_INDENT = 2; // Number of spaces for indentation

function stringifyData(postData: unknown): string {
  try {
    const jsonString = JSON.stringify(
      typeof postData === 'string' ? JSON.parse(postData) : postData,
      null,
      BASE_TAB_INDENT * 4
    );

    return jsonString.replace(/([}\]])$/, '$1'.padStart(BASE_TAB_INDENT * 2));
  } catch {
    return String(postData);
  }
}

// Adds a curl parameter with proper indentation
function addCurlParam(curlParts: string[], flag: string, value: string): void {
  curlParts.push(`${flag.padStart(BASE_TAB_INDENT + flag.length)} ${value}`);
}

function addHttpMethodToCurl(curlParts: string[], method: string): void {
  if (method && hasRequestBody(method)) {
    addCurlParam(curlParts, '-X', method.toUpperCase());
  }
}

function addHeadersToCurl(
  curlParts: string[],
  headers: Record<string, string>
): void {
  Object.entries(headers).forEach(([key, value]) => {
    addCurlParam(curlParts, '-H', escapeShellArg(`${key}: ${value}`));
  });
}

function hasRequestBody(method: string): boolean {
  const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];

  return methodsWithBody.includes(method.toUpperCase());
}

function addBodyToCurl(curlParts: string[], postData: RequestPostData): void {
  if (!postData) {
    return;
  }

  const { type, value } = postData;

  if (type === 'form-data') {
    const formParts = Object.entries(value).map(
      ([key, value]) => `${key}=${stringifyData(value)}`
    );

    formParts.forEach((part) =>
      addCurlParam(curlParts, '--form', escapeShellArg(part))
    );

    return;
  }

  addCurlParam(curlParts, '--data-raw', escapeShellArg(stringifyData(value)));
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

  if (postData && hasRequestBody(method)) {
    addBodyToCurl(curlParts, postData);
  }

  return curlParts.join(' \\\n');
}
