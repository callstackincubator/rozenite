export const VIRTUALIZED_TEXT_THRESHOLD = 50_000;
export const TEXT_CHUNK_SIZE = 2_000;

export type TextRange = readonly [start: number, end: number];

// Keep an index of row boundaries instead of splitting the complete value.
// This lets the virtualizer create text only for visible rows, including a
// single pathological line with no newline boundaries.
export const textRowRanges = (text: string): TextRange[] => {
  const ranges: TextRange[] = [];
  let start = 0;

  while (start < text.length) {
    const newline = text.indexOf('\n', start);
    const lineEnd = newline === -1 ? text.length : newline + 1;

    for (
      let chunkStart = start;
      chunkStart < lineEnd;
      chunkStart += TEXT_CHUNK_SIZE
    ) {
      ranges.push([
        chunkStart,
        Math.min(chunkStart + TEXT_CHUNK_SIZE, lineEnd),
      ]);
    }

    start = lineEnd;
  }

  return ranges.length === 0 ? [[0, 0]] : ranges;
};
