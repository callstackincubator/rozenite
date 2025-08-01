import { escapeShellArg } from './escapeShellArg';

const BASE_TAB_INDENT = 2; // Number of spaces for indentation

// Adds a curl parameter with proper indentation
function addCurlParam(curlParts: string[], flag: string, value: string): void {
  curlParts.push(`${flag.padStart(BASE_TAB_INDENT + flag.length)} ${value}`);
}

// Adds HTTP method to curl command parts
function addMethodToCurl(curlParts: string[], method: string): void {
  if (method && method.toUpperCase() !== 'GET') {
    addCurlParam(curlParts, '-X', method.toUpperCase());
  }
}

// Adds headers to curl command parts
function addHeadersToCurl(curlParts: string[], headers: Record<string, string>): void {
  Object.entries(headers).forEach(([key, value]) => {
    if (key && value) {
      addCurlParam(curlParts, '-H', escapeShellArg(`${key}: ${value}`));
    }
  });
}

// Determines if method should include request body
function shouldIncludeBody(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

// Gets content type from headers (case-insensitive)
function getContentType(headers: Record<string, string>): string {
  return headers['content-type'] || headers['Content-Type'] || '';
}

// Formats JSON data with proper indentation
function formatJsonData(postData: string): string {
  try {
    const jsonString = JSON.stringify(JSON.parse(postData), null, BASE_TAB_INDENT * 4);
    
    return jsonString.replace(/}$/, '}'.padStart(BASE_TAB_INDENT * 4 - 1));
  } catch {
    return postData;
  }
}

// Adds request body to curl command parts
function addBodyToCurl(curlParts: string[], postData: string, headers: Record<string, string>): void {
  const contentType = getContentType(headers);
  
  if (contentType.includes('application/json')) {
    const formattedJson = formatJsonData(postData);
    
    addCurlParam(curlParts, '-d', escapeShellArg(formattedJson));

    return;
  }
  
  if (contentType.includes('application/x-www-form-urlencoded')) {
    addCurlParam(curlParts, '-d', escapeShellArg(postData));
    
    return;
  }
  
  // For other content types, use --data-raw
  addCurlParam(curlParts, '--data-raw', escapeShellArg(postData));
}

// Generates a cURL command from network request data
export function generateCurlCommand(request: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  postData?: string;
}): string {
  const { method, url, headers = {}, postData } = request;
  
  const curlParts: string[] = [`curl ${escapeShellArg(url)}`];
  
  addMethodToCurl(curlParts, method);
  addHeadersToCurl(curlParts, headers);
  
  if (postData && shouldIncludeBody(method)) {
    addBodyToCurl(curlParts, postData, headers);
  }
  
  return curlParts.join(' \\\n');
}
