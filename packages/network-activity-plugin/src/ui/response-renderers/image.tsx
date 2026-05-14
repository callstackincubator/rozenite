import { KeyValueGrid } from '../components/KeyValueGrid';
import type { ResponseRenderer } from './types';

// base64 inflates ~33%; subtract trailing `=` padding to get the
// approximate decoded byte count.
const decodedByteCount = (base64: string): number => {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} bytes`;
};

export const imageRenderer: ResponseRenderer = {
  id: 'image',
  matches: (contentType, body) =>
    typeof body === 'object' &&
    body !== null &&
    body.kind === 'binary' &&
    contentType.startsWith('image/'),
  views: ['preview', 'raw'],
  defaultView: 'preview',
  supportsOverride: false,
  render: ({ view, body, ctx }) => {
    if (typeof body !== 'object' || body === null || body.kind !== 'binary') {
      return null;
    }
    if (view === 'preview') {
      const dataUrl = `data:${ctx.contentType};base64,${body.base64}`;
      return (
        <img
          src={dataUrl}
          alt="Response image"
          className="max-w-full max-h-[400px] object-contain bg-gray-800 rounded-md border border-gray-700 p-2"
        />
      );
    }
    return (
      <KeyValueGrid
        items={[
          {
            key: 'Content-Type',
            value: ctx.contentType,
            valueClassName: 'text-blue-400',
          },
          {
            key: 'Size',
            value: formatBytes(decodedByteCount(body.base64)),
          },
        ]}
      />
    );
  },
};
