export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const BYTES_PER_LINE = 16;
const BYTES_PER_GROUP = 8;
// 16 bytes × 2 hex chars + 14 single inter-byte spaces + 1 extra
// space between groups = 32 + 14 + 2 = 48
const HEX_SECTION_WIDTH = 48;
const OFFSET_WIDTH = 8;
const ASCII_PRINTABLE_MIN = 0x20;
const ASCII_PRINTABLE_MAX = 0x7e;

const toHexPair = (byte: number): string =>
  byte.toString(16).toUpperCase().padStart(2, '0');

const toAsciiChar = (byte: number): string =>
  byte >= ASCII_PRINTABLE_MIN && byte <= ASCII_PRINTABLE_MAX
    ? String.fromCharCode(byte)
    : '.';

const formatHexLine = (slice: readonly number[]): string => {
  const left = slice.slice(0, BYTES_PER_GROUP).map(toHexPair).join(' ');
  const right = slice.slice(BYTES_PER_GROUP).map(toHexPair).join(' ');
  return right ? `${left}  ${right}` : left;
};

export const bytesToGroupedHex = (bytes: readonly number[]): string => {
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += BYTES_PER_LINE) {
    lines.push(formatHexLine(bytes.slice(i, i + BYTES_PER_LINE)));
  }
  return lines.join('\n');
};

export const bytesToHexdump = (bytes: readonly number[]): string => {
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += BYTES_PER_LINE) {
    const slice = bytes.slice(i, i + BYTES_PER_LINE);
    const offset = i.toString(16).padStart(OFFSET_WIDTH, '0');
    const hex = formatHexLine(slice).padEnd(HEX_SECTION_WIDTH, ' ');
    const ascii = slice.map(toAsciiChar).join('');
    lines.push(`${offset}  ${hex}  |${ascii}|`);
  }
  return lines.join('\n');
};

export const bytesToAsciiPreview = (bytes: readonly number[]): string =>
  bytes.map(toAsciiChar).join('');

export const bytesToBase64 = (bytes: readonly number[]): string => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

export const compactBufferPreview = (
  bytes: readonly number[],
  options: { maxBytes?: number } = {},
): string => {
  const maxBytes = options.maxBytes ?? BYTES_PER_GROUP;
  const sizeLabel = `${bytes.length} B`;
  if (bytes.length === 0) {
    return sizeLabel;
  }
  const shown = bytes.slice(0, maxBytes).map(toHexPair).join(' ');
  if (bytes.length <= maxBytes) {
    return `${shown} ${sizeLabel}`;
  }
  return `${shown} … ${sizeLabel}`;
};

// Matches a 4+ hex-digit offset followed by either a colon-space or
// at least two spaces. Avoids false-positives on grouped-hex lines
// where bytes are separated by single spaces.
const HEXDUMP_OFFSET_RE = /^[0-9a-fA-F]{4,16}(?::\s+|\s{2,})/;
const TRAILING_ASCII_COLUMN_RE = /\|[^|]*\|\s*$/;

export const hexInputToBytes = (input: string): ParseResult<number[]> => {
  const cleaned = input
    .split(/\r?\n/)
    .map((line) =>
      line.replace(TRAILING_ASCII_COLUMN_RE, '').replace(HEXDUMP_OFFSET_RE, ''),
    )
    .join('')
    .replace(/0x/gi, '')
    .replace(/\s+/g, '');

  if (cleaned.length === 0) {
    return { ok: false, error: 'Enter at least one byte.' };
  }
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) {
    return { ok: false, error: 'Hex input contains invalid characters.' };
  }
  if (cleaned.length % 2 !== 0) {
    return { ok: false, error: 'Hex input must contain complete bytes.' };
  }
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes.push(parseInt(cleaned.slice(i, i + 2), 16));
  }
  return { ok: true, value: bytes };
};

export const base64ToBytes = (input: string): ParseResult<number[]> => {
  const cleaned = input.replace(/\s+/g, '');
  if (cleaned.length === 0) {
    return { ok: false, error: 'Enter at least one byte.' };
  }
  let binary: string;
  try {
    binary = atob(cleaned);
  } catch {
    return { ok: false, error: 'Base64 input is invalid.' };
  }
  const bytes: number[] = [];
  for (let i = 0; i < binary.length; i++) {
    bytes.push(binary.charCodeAt(i));
  }
  return { ok: true, value: bytes };
};
