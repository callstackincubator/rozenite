import { useMemo } from 'react';
import { ScrollArea } from '../components/ScrollArea';
import { Section } from '../components/Section';
import { KeyValueGrid, KeyValueItem } from '../components/KeyValueGrid';
import { HttpNetworkEntry, SSENetworkEntry } from '../state/model';
import { getStatusColor } from '../utils/getStatusColor';
import { CopyAsCurlButton } from '../components/CopyAsCurlButton';
import { HttpHeaders } from '../../shared/client';

export type HeadersTabProps = {
  selectedRequest: HttpNetworkEntry | SSENetworkEntry;
};

function getHeadersItems(headers?: HttpHeaders): KeyValueItem[] {
  if (!headers) return [];

  return Object.entries(headers).reduce<KeyValueItem[]>((acc, [key, value]) => {
    if (Array.isArray(value)) {
      acc.push(
        ...value.map((item) => ({ key: key.toLowerCase(), value: item }))
      );
    } else {
      acc.push({ key: key.toLowerCase(), value: value });
    }

    return acc;
  }, []);
}

export const HeadersTab = ({ selectedRequest }: HeadersTabProps) => {
  const requestBody = selectedRequest.request.body;

  const generalItems: KeyValueItem[] = useMemo(
    () => [
      {
        key: 'Request URL',
        value: selectedRequest.request.url,
        valueClassName: 'text-blue-400',
      },
      {
        key: 'Request Method',
        value: selectedRequest.request.method,
      },
      {
        key: 'Status Code',
        value: selectedRequest.response?.status ?? 'Pending',
        valueClassName: getStatusColor(selectedRequest.response?.status ?? 0),
      },
      ...(requestBody
        ? [
            {
              key: 'Content-Type',
              value: requestBody.type,
              valueClassName: 'text-blue-400',
            },
          ]
        : []),
    ],
    [selectedRequest]
  );

  const responseHeadersItems = useMemo(
    () => getHeadersItems(selectedRequest.response?.headers),
    [selectedRequest]
  );

  const requestHeadersItems = useMemo(
    () => getHeadersItems(selectedRequest.request.headers),
    [selectedRequest]
  );

  const isCopyAsCurlEnabled =
    selectedRequest.request.body?.data.type !== 'binary';

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-4 space-y-4">
        {isCopyAsCurlEnabled && (
          <CopyAsCurlButton selectedRequest={selectedRequest} />
        )}

        <Section title="General">
          <KeyValueGrid items={generalItems} />
        </Section>

        <Section title="Response Headers">
          <KeyValueGrid
            items={responseHeadersItems}
            emptyMessage="No response headers available"
            className="font-mono"
          />
        </Section>

        <Section title="Request Headers">
          <KeyValueGrid
            items={requestHeadersItems}
            emptyMessage="No request headers available"
            className="font-mono"
          />
        </Section>
      </div>
    </ScrollArea>
  );
};
