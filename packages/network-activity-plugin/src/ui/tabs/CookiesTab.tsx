import React from 'react';
import { Text } from '@rozenite/ui';
import { TabContent } from '../components/TabContent';
import { Section } from '../components/Section';
import { CookieCard } from '../components/CookieCard';
import {
  parseRequestCookiesFromHeaders,
  parseResponseCookiesFromHeaders,
} from '../../utils/cookieParser';
import { HttpNetworkEntry, SSENetworkEntry } from '../state/model';

export type CookiesTabProps = {
  selectedRequest: HttpNetworkEntry | SSENetworkEntry;
};

export const CookiesTab = ({ selectedRequest }: CookiesTabProps) => {
  const requestHeaders = selectedRequest.request?.headers;
  const responseHeaders = selectedRequest.response?.headers;

  const { requestCookies, responseCookies } = React.useMemo(() => {
    return {
      requestCookies: parseRequestCookiesFromHeaders(requestHeaders || {}),
      responseCookies: parseResponseCookiesFromHeaders(responseHeaders || {}),
    };
  }, [requestHeaders, responseHeaders]);

  const hasRequestCookies = requestCookies.length > 0;
  const hasResponseCookies = responseCookies.length > 0;

  if (!hasRequestCookies && !hasResponseCookies) {
    return (
      <TabContent>
        <Text variant="caption">No cookies for this request</Text>
      </TabContent>
    );
  }

  return (
    <TabContent className="gap-6">
      {hasRequestCookies && (
        <Section title={`Request Cookies (${requestCookies.length})`}>
          <div className="flex flex-col gap-2">
            {requestCookies.map((cookie, index) => (
              <CookieCard key={`request-${index}`} cookie={cookie} />
            ))}
          </div>
        </Section>
      )}

      {hasResponseCookies && (
        <Section title={`Response Cookies (${responseCookies.length})`}>
          <div className="flex flex-col gap-2">
            {responseCookies.map((cookie, index) => (
              <CookieCard key={`response-${index}`} cookie={cookie} />
            ))}
          </div>
        </Section>
      )}
    </TabContent>
  );
};
