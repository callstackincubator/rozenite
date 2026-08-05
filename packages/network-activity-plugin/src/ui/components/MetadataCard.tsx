import { Download } from 'lucide-react';
import { KeyValueGrid } from './KeyValueGrid';
import {
  base64ToBlob,
  deriveFilename,
  downloadBlob,
  readHeader,
} from '../utils/download';
import type { RenderCtx } from '../response-renderers/types';

export type MetadataCardBody =
  | { kind: 'binary'; base64: string }
  | { kind: 'binary-too-large'; size: number };

export type MetadataCardProps = {
  body: MetadataCardBody;
  ctx: RenderCtx;
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

// base64 inflates ~33%; subtract trailing `=` padding for the true
// decoded byte count.
const decodedByteCount = (base64: string): number => {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

export const MetadataCard = ({ body, ctx }: MetadataCardProps) => {
  const decodedSize =
    body.kind === 'binary' ? decodedByteCount(body.base64) : body.size;

  const contentLengthHeader = readHeader(ctx.headers, 'Content-Length');
  const filename = deriveFilename({
    headers: ctx.headers,
    url: ctx.url,
    contentType: ctx.contentType,
  });

  const isDownloadAvailable = body.kind === 'binary';
  const downloadTitle = isDownloadAvailable
    ? `Download ${filename}`
    : `Response too large to download (> 5 MB cap, size: ${formatBytes(decodedSize)})`;

  const handleDownload = () => {
    if (body.kind !== 'binary') return;
    const blob = base64ToBlob(body.base64, ctx.contentType);
    downloadBlob(blob, filename);
  };

  return (
    <div className="flex items-start justify-between gap-3 bg-gray-800 border border-gray-700 rounded p-3">
      <div className="flex-1 min-w-0">
        <KeyValueGrid
          items={[
            {
              key: 'Size',
              value: formatBytes(decodedSize),
            },
            ...(contentLengthHeader
              ? [
                  {
                    key: 'Content-Length',
                    value: contentLengthHeader,
                  },
                ]
              : []),
            {
              key: 'Filename',
              value: filename,
            },
          ]}
        />
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={!isDownloadAvailable}
        title={downloadTitle}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-violet-500 text-violet-200 hover:bg-violet-900/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
      >
        <Download className="h-3 w-3" />
        Download
      </button>
    </div>
  );
};
