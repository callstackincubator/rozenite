import { useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { formatHexdumpRow } from './binary';
import { textRowRanges, VIRTUALIZED_TEXT_THRESHOLD } from './large-value-viewer-state';

export const TextValueViewer = ({ value }: { value: string }) => {
  const ranges = useMemo(
    () => (value.length > VIRTUALIZED_TEXT_THRESHOLD ? textRowRanges(value) : null),
    [value],
  );

  if (!ranges) {
    return (
      <pre className="font-mono text-sm text-success whitespace-pre-wrap wrap-anywhere">
        "{value}"
      </pre>
    );
  }

  return (
    <Virtuoso
      aria-label="Large string value"
      className="font-mono text-sm text-success"
      style={{ height: 384 }}
      totalCount={ranges.length}
      itemContent={(index) => {
        const [start, end] = ranges[index];
        return (
          <div className="whitespace-pre-wrap wrap-anywhere">
            {index === 0 ? '"' : ''}
            {value.slice(start, end)}
            {index === ranges.length - 1 ? '"' : ''}
          </div>
        );
      }}
    />
  );
};

export const HexdumpValueViewer = ({ bytes }: { bytes: readonly number[] }) => {
  const totalCount = Math.ceil(bytes.length / 16);

  if (totalCount === 0) {
    return <div className="text-xs text-muted italic">No bytes to display.</div>;
  }

  return (
    <Virtuoso
      aria-label="Buffer hexdump"
      className="font-mono text-xs text-accent"
      style={{ height: 384 }}
      totalCount={totalCount}
      itemContent={(index) => {
        const row = formatHexdumpRow(bytes, index * 16);
        return (
          <div className="flex gap-4 leading-snug whitespace-pre">
            <span className="text-muted">{row.offset}</span>
            <span>{row.hex}</span>
            <span className="text-muted">|{row.ascii}|</span>
          </div>
        );
      }}
    />
  );
};
