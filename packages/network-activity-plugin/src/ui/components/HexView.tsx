import { Virtuoso } from 'react-virtuoso';
import { Text } from '@rozenite/ui';
import { BYTES_PER_HEX_ROW, formatHexRow, rowCountForByteLength } from '../utils/hex';

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
  <div className="flex gap-4 px-3 font-mono text-xs leading-snug whitespace-pre">
    <span className="text-faint">{offset}</span>
    <span className="text-foreground">{hex}</span>
    <span className="text-muted-foreground">{`|${ascii}|`}</span>
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
      <Text variant="caption" className="italic">
        No bytes to display.
      </Text>
    );
  }

  return (
    <div className="border border-border bg-muted py-2">
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
