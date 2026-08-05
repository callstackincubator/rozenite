import { ScrollArea } from '../components/ScrollArea';
import {
  HttpNetworkEntry,
  HttpRequestData,
  SSENetworkEntry,
} from '../state/model';
import { KeyValueGrid } from '../components/KeyValueGrid';
import { Section } from '../components/Section';
import { useMemo } from 'react';
import { RequestBody } from '../components/RequestBody';

export type RequestTabProps = {
  selectedRequest: HttpNetworkEntry | SSENetworkEntry;
};

const getRequestBodySectionTitle = (body: HttpRequestData) => {
  const baseTitle = 'Request Body';

  switch (body.data.type) {
    case 'form-data':
      return `${baseTitle} (FormData)`;

    case 'binary':
      return `${baseTitle} (Binary)`;

    default:
      return baseTitle;
  }
};

export const RequestTab = ({ selectedRequest }: RequestTabProps) => {
  const queryParams = useMemo(() => {
    const { searchParams } = new URL(selectedRequest.request.url);

    return Array.from(searchParams.entries()).map(([key, value]) => ({
      key,
      value,
    }));
  }, [selectedRequest.request.url]);

  const requestBody = selectedRequest.request.body;
  const hasQueryParams = queryParams.length > 0;

  const renderQueryParams = () => {
    if (!hasQueryParams) {
      return null;
    }

    return (
      <Section title={`Query Parameters (${queryParams.length})`}>
        <KeyValueGrid items={queryParams} />
      </Section>
    );
  };

  const renderRequestBody = () => {
    if (!requestBody) {
      return null;
    }

    return (
      <Section title={getRequestBodySectionTitle(requestBody)}>
        <RequestBody data={requestBody.data} />
      </Section>
    );
  };

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-4 space-y-4">
        {renderQueryParams()}
        {renderRequestBody()}
        {!hasQueryParams && !requestBody && (
          <div className="text-sm text-gray-400">
            No request body or query params for this request
          </div>
        )}
      </div>
    </ScrollArea>
  );
};
