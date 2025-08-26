import { HttpRequestData } from '../state/model';
import { KeyValueGrid, KeyValueItem } from './KeyValueGrid';
import { CodeBlock } from './CodeBlock';
import { JsonTree } from './JsonTree';
import {
  RequestBinaryPostData,
  RequestFormDataPostData,
} from '../../shared/client';

type RequestBodyProps = {
  data: HttpRequestData['data'];
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

export const RequestBody = ({ data }: RequestBodyProps) => {
  const { type: dataType, value } = data;

  if (dataType === 'text') {
    try {
      const jsonData = JSON.parse(value);

      return (
        <CodeBlock>
          <JsonTree data={jsonData} />
        </CodeBlock>
      );
    } catch {
      return <CodeBlock>{value}</CodeBlock>;
    }
  }

  if (dataType === 'form-data') {
    return <KeyValueGrid items={getFormDataEntries(value)} />;
  }

  if (dataType === 'binary') {
    return <KeyValueGrid items={getBinaryEntries(value)} />;
  }

  return null;
};
