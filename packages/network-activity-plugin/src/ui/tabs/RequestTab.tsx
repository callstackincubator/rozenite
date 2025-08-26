import * as React from 'react';
import { ScrollArea } from '../components/ScrollArea';
import { JsonTree } from '../components/JsonTree';
import {
  HttpNetworkEntry,
  HttpRequestData,
  SSENetworkEntry,
} from '../state/model';
import { KeyValueGrid, KeyValueItem } from '../components/KeyValueGrid';
import { Section } from '../components/Section';
import { CodeBlock } from '../components/CodeBlock';
import { ReactNode, useMemo } from 'react';
import {
  RequestBinaryPostData,
  RequestFormDataPostData,
} from '../../shared/client';

export type RequestTabProps = {
  selectedRequest: HttpNetworkEntry | SSENetworkEntry;
};

const getFormDataBinaryEntries = (
  key: string,
  value: RequestBinaryPostData['value']
): KeyValueItem[] => {
  return [
    {
      key,
      value: <span className="text-blue-400">[binary]</span>,
    },
    ...getBinaryEntries(value).map((item) => ({
      ...item,
      key: `  └─  ${item.key}`,
      keyClassName: 'whitespace-pre',
    })),
  ];
};

const getBinaryEntries = (
  value: RequestBinaryPostData['value']
): KeyValueItem[] => {
  const { size, type, name } = value;

  const items: KeyValueItem[] = [];

  if (name) {
    items.push({ key: 'Name', value: name });
  }

  if (type) {
    items.push({ key: 'Type', value: type });
  }

  items.push({ key: 'Size', value: `${size} bytes` });

  return items;
};

const getFormDataEntries = (value: RequestFormDataPostData['value']) =>
  Object.entries(value).flatMap(([key, { value, type }]) => {
    if (type === 'binary') {
      return getFormDataBinaryEntries(key, value);
    }

    return [{ key, value }];
  });

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
    if (hasQueryParams) {
      return (
        <Section title={`Query Parameters (${queryParams.length})`}>
          <KeyValueGrid items={queryParams} />
        </Section>
      );
    }

    return null;
  };

  const renderRequestBody = () => {
    if (!requestBody) {
      return null;
    }

    const { data } = requestBody;
    const { type: dataType, value } = data;

    let bodyContent: ReactNode = null;

    if (dataType === 'text') {
      try {
        const jsonData = JSON.parse(value);

        bodyContent = (
          <CodeBlock>
            <JsonTree data={jsonData} />
          </CodeBlock>
        );
      } catch {
        bodyContent = <CodeBlock>{value}</CodeBlock>;
      }
    }

    if (dataType === 'form-data') {
      bodyContent = <KeyValueGrid items={getFormDataEntries(value)} />;
    }

    if (dataType === 'binary') {
      bodyContent = <KeyValueGrid items={getBinaryEntries(value)} />;
    }

    return (
      <Section title={getRequestBodySectionTitle(requestBody)}>
        {bodyContent}
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
