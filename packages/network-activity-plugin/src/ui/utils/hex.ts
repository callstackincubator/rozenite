// Byte-level helpers shared by HexView and any future binary-inspection
// surface. Kept small and pure so unit tests don't need a DOM.

export const BYTES_PER_HEX_ROW = 16;
// One blank space between bytes, plus an extra blank space after byte 8
// to group the row into halves. Same convention as `xxd`.
export const BYTES_PER_GROUP = 8;

const ASCII_PRINTABLE_MIN = 0x20;
const ASCII_PRINTABLE_MAX = 0x7e;

export const toHexPair = (byte: number): string =>
  byte.toString(16).toUpperCase().padStart(2, '0');

export const toAsciiChar = (byte: number): string =>
  byte >= ASCII_PRINTABLE_MIN && byte <= ASCII_PRINTABLE_MAX
    ? String.fromCharCode(byte)
    : '.';

export type HexRow = {
  offset: string;
  hex: string;
  ascii: string;
};

const sliceHexBytes = (
  bytes: Uint8Array,
  start: number,
  end: number,
): number[] => {
  const out: number[] = [];
  const limit = Math.min(end, bytes.length);
  for (let i = start; i < limit; i++) {
    out.push(bytes[i]);
  }
  return out;
};

export const formatHexRow = (bytes: Uint8Array, rowStart: number): HexRow => {
  const rowEnd = rowStart + BYTES_PER_HEX_ROW;
  const leftSlice = sliceHexBytes(bytes, rowStart, rowStart + BYTES_PER_GROUP);
  const rightSlice = sliceHexBytes(bytes, rowStart + BYTES_PER_GROUP, rowEnd);

  const left = leftSlice.map(toHexPair).join(' ');
  const right = rightSlice.map(toHexPair).join(' ');
  const hex = right ? `${left}  ${right}` : left;

  const asciiSlice = sliceHexBytes(bytes, rowStart, rowEnd);
  const ascii = asciiSlice.map(toAsciiChar).join('');

  return {
    offset: rowStart.toString(16).padStart(8, '0'),
    hex,
    ascii,
  };
};

export const rowCountForByteLength = (byteLength: number): number =>
  Math.ceil(byteLength / BYTES_PER_HEX_ROW);
