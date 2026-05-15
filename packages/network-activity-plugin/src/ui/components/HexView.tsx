import { Virtuoso } from 'react-virtuoso';
import {
  BYTES_PER_HEX_ROW,
  formatHexRow,
  rowCountForByteLength,
} from '../utils/hex';

export type HexViewProps = {
  bytes: Uint8Array;
};

type HexRowProps = {
  offset: string;
  hex: string;
  ascii: string;
};

// Rendered each scroll tick by virtuoso. Kept inline rather than
// memoized because the per-row work is dominated by `formatHexRow`
// which itself is cheap; memoizing wouldn't change cost meaningfully.
const HexRow = ({ offset, hex, ascii }: HexRowProps) => (
  <div className="flex gap-4 font-mono text-xs leading-snug whitespace-pre">
    <span className="text-gray-500">{offset}</span>
    <span className="text-gray-200">{hex}</span>
    <span className="text-gray-400">{`|${ascii}|`}</span>
  </div>
);

// Virtualized hex view. Each row is the classic offset / hex / ASCII
// triple; native text selection covers what's currently rendered
// (off-screen rows are unmounted, by design). When users need every
// byte they reach for the Download button on the metadata card.
export const HexView = ({ bytes }: HexViewProps) => {
  const totalCount = rowCountForByteLength(bytes.byteLength);

  if (totalCount === 0) {
    return (
      <div className="text-xs text-gray-500 italic">No bytes to display.</div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded">
      <Virtuoso
        style={{ height: 320 }}
        totalCount={totalCount}
        itemContent={(index) => {
          const row = formatHexRow(bytes, index * BYTES_PER_HEX_ROW);
          return <HexRow offset={row.offset} hex={row.hex} ascii={row.ascii} />;
        }}
      />
    </div>
  );
};
