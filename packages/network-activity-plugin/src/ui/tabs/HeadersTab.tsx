import { useMemo } from 'react';
import { cn } from '@rozenite/ui';
import { TabContent } from '../components/TabContent';
import { Section } from '../components/Section';
import { KeyValueGrid, KeyValueItem } from '../components/KeyValueGrid';
import { HttpNetworkEntry, SSENetworkEntry } from '../state/model';
import { getStatusTextClassName } from '../utils/getStatusTone';
import { CopyRequestDropdown } from '../components/CopyRequestDropdown';
import { HttpHeaders } from '../../shared/client';

export type HeadersTabProps = {
  selectedRequest: HttpNetworkEntry | SSENetworkEntry;
};

function getHeadersItems(headers?: HttpHeaders): KeyValueItem[] {
  if (!headers) return [];

  return Object.entries(headers).reduce<KeyValueItem[]>((acc, [key, value]) => {
    if (Array.isArray(value)) {
      acc.push(...value.map((item) => ({ key: key.toLowerCase(), value: item })));
    } else {
      acc.push({ key: key.toLowerCase(), value: value });
    }

    return acc;
  }, []);
}

export const HeadersTab = ({ selectedRequest }: HeadersTabProps) => {
  const requestBody = selectedRequest.request.body;
  const sourceLabel =
    selectedRequest.source === 'nitro'
      ? 'Nitro'
      : selectedRequest.source === 'expo'
        ? 'Expo'
        : selectedRequest.source === 'builtin'
          ? 'Built-in'
          : null;

  const generalItems: KeyValueItem[] = useMemo(
    () => [
      {
        key: 'Request URL',
        value: selectedRequest.request.url,
        valueClassName: 'font-mono text-xs',
      },
      {
        key: 'Request Method',
        value: selectedRequest.request.method,
        valueClassName: 'font-mono text-xs',
      },
      {
        key: 'Status Code',
        value: selectedRequest.response?.status ?? 'Pending',
        valueClassName: cn(
          'font-mono text-xs',
          getStatusTextClassName(selectedRequest.response?.status ?? 0),
        ),
      },
      ...(requestBody
        ? [
            {
              key: 'Content-Type',
              value: requestBody.type,
              valueClassName: 'font-mono text-xs',
            },
          ]
        : []),
      ...(sourceLabel
        ? [
            {
              key: 'Source',
              value: sourceLabel,
              valueClassName: 'font-mono text-xs',
            },
          ]
        : []),
    ],
    [requestBody, selectedRequest, sourceLabel],
  );

  const responseHeadersItems = useMemo(
    () => getHeadersItems(selectedRequest.response?.headers),
    [selectedRequest],
  );

  const requestHeadersItems = useMemo(
    () => getHeadersItems(selectedRequest.request.headers),
    [selectedRequest],
  );

  return (
    <TabContent>
      <CopyRequestDropdown selectedRequest={selectedRequest} />

      <Section title="General">
        <KeyValueGrid items={generalItems} />
      </Section>

      <Section title="Response Headers">
        <KeyValueGrid
          variant="data"
          items={responseHeadersItems}
          emptyMessage="No response headers available"
        />
      </Section>

      <Section title="Request Headers">
        <KeyValueGrid
          variant="data"
          items={requestHeadersItems}
          emptyMessage="No request headers available"
        />
      </Section>
    </TabContent>
  );
};
