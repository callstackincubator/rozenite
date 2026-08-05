import { CodeBlock } from '../components/CodeBlock';
import { JsonTree } from '../components/JsonTree';
import { isJsonContentType } from '../../utils/getContentTypeMimeType';
import type { ResponseRenderer } from './types';

export const jsonRenderer: ResponseRenderer = {
  id: 'json',
  matches: (contentType, body) =>
    typeof body === 'string' && isJsonContentType(contentType),
  views: ['preview', 'raw'],
  defaultView: 'preview',
  supportsOverride: true,
  render: ({ view, body }) => {
    if (typeof body !== 'string') return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
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
    if (view === 'raw') {
      // Pretty-print regardless of the wire format. APIs commonly ship
      // minified JSON, and re-serializing with 2-space indent is what
      // makes the Raw view readable.
      return <CodeBlock>{JSON.stringify(parsed, null, 2)}</CodeBlock>;
    }
    return (
      <CodeBlock>
        <JsonTree data={parsed} />
      </CodeBlock>
    );
  },
};
