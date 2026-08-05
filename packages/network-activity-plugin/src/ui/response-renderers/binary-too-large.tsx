import type { ResponseRenderer } from './types';

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} bytes`;
};

export const binaryTooLargeRenderer: ResponseRenderer = {
  id: 'binary-too-large',
  matches: (_contentType, body) =>
    typeof body === 'object' &&
    body !== null &&
    body.kind === 'binary-too-large',
  views: ['raw'],
  defaultView: 'raw',
  supportsOverride: false,
  render: ({ body }) => {
    if (
      typeof body !== 'object' ||
      body === null ||
      body.kind !== 'binary-too-large'
    ) {
      return null;
    }
    return (
      <div className="text-sm text-gray-400">
        Response too large for preview ({formatBytes(body.size)})
      </div>
    );
  },
};
