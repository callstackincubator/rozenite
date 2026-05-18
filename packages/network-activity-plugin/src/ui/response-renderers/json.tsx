import { CodeBlock } from '../components/CodeBlock';
import { JsonTree } from '../components/JsonTree';
import { isJsonContentType } from '../../utils/getContentTypeMimeType';
import type { ResponseRenderer } from './types';

export const jsonRenderer: ResponseRenderer = {
  id: 'json',
  matches: (contentType, body) =>
    typeof body === 'string' && isJsonContentType(contentType),
  views: ['preview'],
  defaultView: 'preview',
  supportsOverride: true,
  render: ({ body }) => {
    if (typeof body !== 'string') return null;
    try {
      const parsed: unknown = JSON.parse(body);
      return (
        <CodeBlock>
          <JsonTree data={parsed} />
        </CodeBlock>
      );
    } catch {
      return (
        <>
          <CodeBlock>{body}</CodeBlock>
          <div className="text-xs text-gray-500 mt-1">
            ⚠️ Failed to parse as JSON, showing as raw text
          </div>
        </>
      );
    }
  },
};
