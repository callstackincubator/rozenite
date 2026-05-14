import { CodeBlock } from '../components/CodeBlock';
import type { ResponseRenderer } from './types';

export const svgRenderer: ResponseRenderer = {
  id: 'svg',
  matches: (contentType, body) =>
    typeof body === 'string' && contentType.startsWith('image/svg+xml'),
  views: ['preview', 'raw'],
  defaultView: 'preview',
  supportsOverride: false,
  render: ({ view, body }) => {
    if (typeof body !== 'string') return null;
    if (view === 'preview') {
      // <img>-embedded SVG runs no scripts in any major browser — this
      // is the safe way to render SVG from untrusted servers.
      const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(body)}`;
      return (
        <img
          src={dataUrl}
          alt="SVG response"
          className="max-w-full max-h-[400px] object-contain bg-gray-800 rounded-md border border-gray-700 p-2"
        />
      );
    }
    return <CodeBlock>{body}</CodeBlock>;
  },
};
