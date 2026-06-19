import { CodeBlock } from '../components/CodeBlock';
import type { ResponseRenderer } from './types';

export const textFallbackRenderer: ResponseRenderer = {
  id: 'text-fallback',
  matches: (_contentType, body) => typeof body === 'string',
  views: ['raw'],
  defaultView: 'raw',
  supportsOverride: true,
  render: ({ body }) => {
    if (typeof body !== 'string') return null;
    return <CodeBlock>{body}</CodeBlock>;
  },
};
