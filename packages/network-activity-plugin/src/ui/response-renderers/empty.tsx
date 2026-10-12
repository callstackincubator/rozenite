import { Text } from '@rozenite/ui';
import type { ResponseRenderer } from './types';

export const emptyRenderer: ResponseRenderer = {
  id: 'empty',
  matches: (_contentType, body) => body === null,
  views: [],
  defaultView: 'raw',
  supportsOverride: false,
  render: () => <Text variant="caption">No response body available for this request</Text>,
};
