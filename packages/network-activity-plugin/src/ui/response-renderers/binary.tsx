import { HexView } from '../components/HexView';
import { MetadataCard } from '../components/MetadataCard';
import { base64ToBytes } from '../utils/download';
import type { ResponseRenderer } from './types';

// Non-image binary: PDF, audio, video, fonts, application/octet-stream,
// anything else the server returns as bytes that isn't an image and
// isn't text-friendly. The Raw view is the only sensible surface here
// — there's no "preview" of a font or a zip the way there is of a PNG.
export const binaryRenderer: ResponseRenderer = {
  id: 'binary',
  matches: (contentType, body) =>
    typeof body === 'object' &&
    body !== null &&
    body.kind === 'binary' &&
    !contentType.startsWith('image/'),
  views: ['raw'],
  defaultView: 'raw',
  supportsOverride: false,
  render: ({ body, ctx }) => {
    if (typeof body !== 'object' || body === null || body.kind !== 'binary') {
      return null;
    }
    return (
      <div className="space-y-3">
        <MetadataCard body={body} ctx={ctx} />
        <HexView bytes={base64ToBytes(body.base64)} />
      </div>
    );
  },
};
