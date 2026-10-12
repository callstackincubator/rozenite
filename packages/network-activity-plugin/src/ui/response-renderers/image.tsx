import { HexView } from '../components/HexView';
import { MetadataCard } from '../components/MetadataCard';
import { base64ToBytes } from '../utils/download';
import type { ResponseRenderer } from './types';

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
          className="max-h-[400px] max-w-full border border-border bg-muted object-contain p-2"
        />
      );
    }
    return (
      <div className="flex flex-col gap-3">
        <MetadataCard body={body} ctx={ctx} />
        <HexView bytes={base64ToBytes(body.base64)} />
      </div>
    );
  },
};
