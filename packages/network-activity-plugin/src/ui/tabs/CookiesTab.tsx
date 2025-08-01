import { ScrollArea } from '../components/ScrollArea';
import { Badge } from '../components/Badge';
import { NetworkEntry } from '../types';
import { HttpHeaders } from '../../shared/client';

type Cookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  maxAge?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
};

export type CookiesTabProps = {
  selectedRequest: {
    id: string;
  };
  networkEntries: Map<string, NetworkEntry>;
};

const parseCookieString = (cookieString: string): Cookie[] => {
  if (!cookieString) return [];

  return cookieString
    .split(';')
    .map((cookieStr) => {
      const [nameValue, ...attributes] = cookieStr.trim().split(';');
      const [name, value] = nameValue.split('=');

      const cookieObj: Cookie = {
        name: name?.trim() || '',
        value: value?.trim() || '',
      };

      // Parse attributes
      attributes.forEach((attr) => {
        const [attrName, attrValue] = attr.trim().split('=');
        const lowerAttrName = attrName.toLowerCase();

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
    })
    .filter((cookieObj) => cookieObj.name); // Filter out empty cookies
};

const extractCookiesFromHeaders = (
  headers: HttpHeaders
): {
  requestCookies: Cookie[];
  responseCookies: Cookie[];
} => {
  const requestCookies: Cookie[] = [];
  const responseCookies: Cookie[] = [];

  Object.entries(headers).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();

    if (lowerKey === 'cookie') {
      // Cookie header contains all cookies in one string
      requestCookies.push(...parseCookieString(value));
    } else if (lowerKey === 'set-cookie') {
      // Set-Cookie header contains one cookie with attributes
      const cookies = parseCookieString(value);
      responseCookies.push(...cookies);
    }
  });

  return { requestCookies, responseCookies };
};

export const CookiesTab = ({
  selectedRequest,
  networkEntries,
}: CookiesTabProps) => {
  return (
    <ScrollArea className="h-full min-h-0 p-4">
      {(() => {
        const entry = networkEntries.get(selectedRequest.id);
        if (!entry) {
          return (
            <div className="text-sm text-gray-400">
              No request data available
            </div>
          );
        }

        // Extract cookies from request and response headers separately
        const requestHeaders = entry.request?.headers || {};
        const responseHeaders = entry.response?.headers || {};

        const { requestCookies } = extractCookiesFromHeaders(requestHeaders);
        const { responseCookies } = extractCookiesFromHeaders(responseHeaders);

        const hasRequestCookies = requestCookies.length > 0;
        const hasResponseCookies = responseCookies.length > 0;

        if (!hasRequestCookies && !hasResponseCookies) {
          return (
            <div className="text-sm text-gray-400">
              No cookies for this request
            </div>
          );
        }

        return (
          <div className="space-y-6">
            {/* Request Cookies */}
            {hasRequestCookies && (
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">
                  Request Cookies ({requestCookies.length})
                </h4>
                <div className="space-y-2">
                  {requestCookies.map((cookie, index) => (
                    <div
                      key={`request-${index}`}
                      className="bg-gray-800 border border-gray-700 rounded p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-400">
                          {cookie.name}
                        </span>
                        <div className="flex items-center gap-2">
                          {cookie.secure && (
                            <Badge
                              variant="outline"
                              className="text-xs text-yellow-400 border-yellow-400"
                            >
                              Secure
                            </Badge>
                          )}
                          {cookie.httpOnly && (
                            <Badge
                              variant="outline"
                              className="text-xs text-purple-400 border-purple-400"
                            >
                              HttpOnly
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-300 mb-2">
                        {cookie.value}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
                        {cookie.domain && (
                          <div>
                            <span className="font-medium">Domain:</span>{' '}
                            {cookie.domain}
                          </div>
                        )}
                        {cookie.path && (
                          <div>
                            <span className="font-medium">Path:</span>{' '}
                            {cookie.path}
                          </div>
                        )}
                        {cookie.expires && (
                          <div>
                            <span className="font-medium">Expires:</span>{' '}
                            {cookie.expires}
                          </div>
                        )}
                        {cookie.maxAge && (
                          <div>
                            <span className="font-medium">Max-Age:</span>{' '}
                            {cookie.maxAge}
                          </div>
                        )}
                        {cookie.sameSite && (
                          <div>
                            <span className="font-medium">SameSite:</span>{' '}
                            {cookie.sameSite}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Response Cookies */}
            {hasResponseCookies && (
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">
                  Response Cookies ({responseCookies.length})
                </h4>
                <div className="space-y-2">
                  {responseCookies.map((cookie, index) => (
                    <div
                      key={`response-${index}`}
                      className="bg-gray-800 border border-gray-700 rounded p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-400">
                          {cookie.name}
                        </span>
                        <div className="flex items-center gap-2">
                          {cookie.secure && (
                            <Badge
                              variant="outline"
                              className="text-xs text-yellow-400 border-yellow-400"
                            >
                              Secure
                            </Badge>
                          )}
                          {cookie.httpOnly && (
                            <Badge
                              variant="outline"
                              className="text-xs text-purple-400 border-purple-400"
                            >
                              HttpOnly
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-300 mb-2">
                        {cookie.value}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
                        {cookie.domain && (
                          <div>
                            <span className="font-medium">Domain:</span>{' '}
                            {cookie.domain}
                          </div>
                        )}
                        {cookie.path && (
                          <div>
                            <span className="font-medium">Path:</span>{' '}
                            {cookie.path}
                          </div>
                        )}
                        {cookie.expires && (
                          <div>
                            <span className="font-medium">Expires:</span>{' '}
                            {cookie.expires}
                          </div>
                        )}
                        {cookie.maxAge && (
                          <div>
                            <span className="font-medium">Max-Age:</span>{' '}
                            {cookie.maxAge}
                          </div>
                        )}
                        {cookie.sameSite && (
                          <div>
                            <span className="font-medium">SameSite:</span>{' '}
                            {cookie.sameSite}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </ScrollArea>
  );
};
