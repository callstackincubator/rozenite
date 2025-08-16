import { Cookie, HttpHeaders } from '../shared/client';
import { getHttpHeader } from './getHttpHeader';

export const parseSetCookieHeader = (setCookieStr: string): Cookie => {
  const parts = setCookieStr.split(';').map((p) => p.trim());
  const [nameValue, ...attributes] = parts;
  const [name, ...valueParts] = nameValue.split('=');

  const value = valueParts.join('=');

  const cookieObj: Cookie = {
    name: name?.trim() || '',
    value: value?.trim() || '',
  };

  attributes.forEach((attr) => {
    const [attrName, ...attrValueParts] = attr.split('=');
    const lowerAttrName = attrName.trim().toLowerCase();
    const attrValue = attrValueParts.join('=');

    switch (lowerAttrName) {
      case 'domain':
        cookieObj.domain = attrValue;

        break;

      case 'path':
        cookieObj.path = attrValue;

        break;

      case 'expires':
        cookieObj.expires = attrValue;

        break;

      case 'max-age':
        cookieObj.maxAge = attrValue;

        break;

      case 'secure':
        cookieObj.secure = true;

        break;

      case 'httponly':
        cookieObj.httpOnly = true;

        break;

      case 'samesite':
        cookieObj.sameSite = attrValue;

        break;
    }
  });

  return cookieObj;
};

export const splitSetCookieHeaderByComma = (header: string): string[] => {
  const regex = /(?:^|,\s)([^=;,]+=[^;]+(?:;[^,]*)*)/g;
  const matches: string[] = [];

  let match;

  while ((match = regex.exec(header)) !== null) {
    matches.push(match[1].trim());
  }

  return matches;
};

export const parseCookieHeader = (cookieString: string): Cookie[] => {
  if (!cookieString) return [];

  return cookieString
    .split(';')
    .map((cookieStr) => {
      const [name, ...valueParts] = cookieStr.trim().split('=');
      const value = valueParts.join('=');

      return {
        name: name?.trim() || '',
        value: value?.trim() || '',
      };
    })
    .filter((cookieObj) => cookieObj.name);
};

export const parseRequestCookiesFromHeaders = (
  headers: HttpHeaders
): Cookie[] => {
  const cookieHeader = getHttpHeader(headers, 'cookie');

  if (!cookieHeader) {
    return [];
  }

  const { value } = cookieHeader;

  if (Array.isArray(value)) {
    return value.flatMap(parseCookieHeader);
  }

  return parseCookieHeader(value);
};

export const parseResponseCookiesFromHeaders = (
  headers: HttpHeaders
): Cookie[] => {
  const setCookieHeader = getHttpHeader(headers, 'set-cookie');

  if (!setCookieHeader) {
    return [];
  }

  const { value } = setCookieHeader;

  if (Array.isArray(value)) {
    return value.flatMap(parseSetCookieHeader);
  }

  return [parseSetCookieHeader(value)];
};
