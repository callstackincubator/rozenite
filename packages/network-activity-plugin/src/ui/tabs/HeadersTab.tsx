import { useMemo } from 'react';
import { ScrollArea } from '../components/ScrollArea';
import { Section } from '../components/Section';
import { KeyValueGrid, KeyValueItem } from '../components/KeyValueGrid';
import { HttpNetworkEntry, SSENetworkEntry } from '../state/model';
import { getStatusColor } from '../utils/getStatusColor';
import { CopyAsCurlButton } from '../components/CopyAsCurlButton';

export type HeadersTabProps = {
  selectedRequest: HttpNetworkEntry | SSENetworkEntry;
};

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

  const responseHeadersItems: KeyValueItem[] = useMemo(() => {
    const headers = selectedRequest.response?.headers;

    if (!headers) return [];

    return Object.entries(headers).map(([key, value]) => ({
      key: key.toLowerCase(),
      value,
    }));
  }, [selectedRequest.response?.headers]);

  const requestHeadersItems: KeyValueItem[] = useMemo(() => {
    const headers = selectedRequest.request.headers;

    if (!headers) return [];

    return Object.entries(headers).map(([key, value]) => ({
      key: key.toLowerCase(),
      value,
    }));
  }, [selectedRequest.request.headers]);

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
