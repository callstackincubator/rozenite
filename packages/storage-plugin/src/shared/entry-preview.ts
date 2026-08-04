import type { StorageEntry, StorageEntryPreview } from './types';

export const MAX_STRING_PREVIEW_CODE_POINTS = 256;
export const MAX_BUFFER_PREVIEW_BYTES = 16;

const toHexPair = (byte: number): string =>
  byte.toString(16).toUpperCase().padStart(2, '0');

const truncateString = (
  value: string,
): Pick<StorageEntryPreview, 'preview' | 'isTruncated'> => {
  let preview = '';
  let codePointCount = 0;

  for (const codePoint of value) {
    if (codePointCount === MAX_STRING_PREVIEW_CODE_POINTS) {
      return { preview, isTruncated: true };
    }

    preview += codePoint;
    codePointCount += 1;
  }

  return { preview, isTruncated: false };
};

export const toStorageEntryPreview = (
  entry: StorageEntry,
): StorageEntryPreview => {
  if (entry.type === 'string') {
    return {
      key: entry.key,
      type: entry.type,
      ...truncateString(entry.value),
      // JavaScript strings expose their length in UTF-16 code units.
      valueSize: entry.value.length,
    };
  }

  if (entry.type === 'buffer') {
    const shownBytes = entry.value.slice(0, MAX_BUFFER_PREVIEW_BYTES);
    return {
      key: entry.key,
      type: entry.type,
      preview: shownBytes.map(toHexPair).join(' '),
      valueSize: entry.value.length,
      isTruncated: entry.value.length > MAX_BUFFER_PREVIEW_BYTES,
    };
  }

  const preview = String(entry.value);
  return {
    key: entry.key,
    type: entry.type,
    preview,
    valueSize: preview.length,
    isTruncated: false,
  };
};
