import * as React from 'react';
import { ScrollArea } from '../components/ScrollArea';
import { JsonTree } from '../components/JsonTree';
import { HttpNetworkEntry, SSENetworkEntry } from '../state/model';
import { KeyValueGrid } from '../components/KeyValueGrid';
import { Section } from '../components/Section';
import { CodeBlock } from '../components/CodeBlock';
import { ReactNode, useMemo } from 'react';

export type RequestTabProps = {
  selectedRequest: HttpNetworkEntry | SSENetworkEntry;
};

export const RequestTab = ({ selectedRequest }: RequestTabProps) => {
  const queryParams = useMemo(() => {
    const { searchParams } = new URL(selectedRequest.request.url);

    return Array.from(searchParams.entries());
  }, [selectedRequest.request.url]);

  const requestBody = selectedRequest.request.body;
  const hasQueryParams = queryParams.length > 0;

  const renderQueryParams = () => {
    if (hasQueryParams) {
      return (
        <Section title={`Query Parameters (${queryParams.length})`}>
          <KeyValueGrid
            items={queryParams.map(([key, value]) => ({
              key,
              value,
            }))}
          />
        </Section>
      );
    }

    return null;
  };

  const renderRequestBody = () => {
    if (!requestBody) {
      return null;
    }

    const { type, data } = requestBody;
    const { type: dataType, value } = data;

    let bodyContent: ReactNode = null;

    if (dataType === 'text') {
      try {
        const jsonData = JSON.parse(value);

        bodyContent = <JsonTree data={jsonData} />;
      } catch {
        bodyContent = value;
      }
    }

    // Show JSON tree as a temporary solution for form-data and binary types
    if (dataType === 'form-data' || dataType === 'binary') {
      bodyContent = <JsonTree data={value} />
    }

    return (
      <Section title="Request Body">
        <div className="space-y-4">
          <KeyValueGrid
            items={[
              {
                key: 'Content-Type',
                value: type,
                valueClassName: 'text-blue-400',
              },
            ]}
          />
          {bodyContent && <CodeBlock>{bodyContent}</CodeBlock>}
        </div>
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
