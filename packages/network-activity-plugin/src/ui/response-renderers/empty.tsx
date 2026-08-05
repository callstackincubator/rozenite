import type { ResponseRenderer } from './types';

export const emptyRenderer: ResponseRenderer = {
  id: 'empty',
  matches: (_contentType, body) => body === null,
  views: [],
  defaultView: 'raw',
  supportsOverride: false,
  render: () => (
    <div className="text-sm text-gray-400">
      No response body available for this request
    </div>
  ),
};
