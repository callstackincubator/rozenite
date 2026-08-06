import { describe, expect, it } from 'vitest';
import {
  MAX_BUFFER_PREVIEW_BYTES,
  MAX_STRING_PREVIEW_CODE_POINTS,
  toStorageEntryPreview,
} from '../entry-preview';

describe('toStorageEntryPreview', () => {
  it('represents empty and boundary-sized strings completely', () => {
    expect(toStorageEntryPreview({ key: 'empty', type: 'string', value: '' })).toEqual({
      key: 'empty',
      type: 'string',
      preview: '',
      valueSize: 0,
      isTruncated: false,
    });

    const value = 'a'.repeat(MAX_STRING_PREVIEW_CODE_POINTS);
    expect(toStorageEntryPreview({ key: 'boundary', type: 'string', value })).toEqual({
      key: 'boundary',
      type: 'string',
      preview: value,
      valueSize: MAX_STRING_PREVIEW_CODE_POINTS,
      isTruncated: false,
    });
  });

  it('truncates an oversized string at the fixed code-point boundary', () => {
    const value = `${'a'.repeat(MAX_STRING_PREVIEW_CODE_POINTS)}z`;

    expect(toStorageEntryPreview({ key: 'long', type: 'string', value })).toEqual({
      key: 'long',
      type: 'string',
      preview: 'a'.repeat(MAX_STRING_PREVIEW_CODE_POINTS),
      valueSize: MAX_STRING_PREVIEW_CODE_POINTS + 1,
      isTruncated: true,
    });
  });

  it('does not split Unicode code points while preserving string length', () => {
    const value = `${'😀'.repeat(MAX_STRING_PREVIEW_CODE_POINTS)}!`;

    expect(toStorageEntryPreview({ key: 'emoji', type: 'string', value })).toEqual({
      key: 'emoji',
      type: 'string',
      preview: '😀'.repeat(MAX_STRING_PREVIEW_CODE_POINTS),
      valueSize: value.length,
      isTruncated: true,
    });
  });

  it('formats primitive values completely', () => {
    expect(toStorageEntryPreview({ key: 'count', type: 'number', value: 42 })).toEqual({
      key: 'count',
      type: 'number',
      preview: '42',
      valueSize: 2,
      isTruncated: false,
    });
    expect(toStorageEntryPreview({ key: 'enabled', type: 'boolean', value: false })).toEqual({
      key: 'enabled',
      type: 'boolean',
      preview: 'false',
      valueSize: 5,
      isTruncated: false,
    });
  });

  it('formats empty and boundary-sized buffers as hexadecimal', () => {
    expect(toStorageEntryPreview({ key: 'empty', type: 'buffer', value: [] })).toEqual({
      key: 'empty',
      type: 'buffer',
      preview: '',
      valueSize: 0,
      isTruncated: false,
    });

    const value = new Array(MAX_BUFFER_PREVIEW_BYTES).fill(0xab);
    expect(toStorageEntryPreview({ key: 'boundary', type: 'buffer', value })).toEqual({
      key: 'boundary',
      type: 'buffer',
      preview: new Array(MAX_BUFFER_PREVIEW_BYTES).fill('AB').join(' '),
      valueSize: MAX_BUFFER_PREVIEW_BYTES,
      isTruncated: false,
    });
  });

  it('truncates oversized buffers at the fixed byte boundary', () => {
    const value = [...new Array(MAX_BUFFER_PREVIEW_BYTES).fill(0xab), 0xcd];

    expect(toStorageEntryPreview({ key: 'long', type: 'buffer', value })).toEqual({
      key: 'long',
      type: 'buffer',
      preview: new Array(MAX_BUFFER_PREVIEW_BYTES).fill('AB').join(' '),
      valueSize: MAX_BUFFER_PREVIEW_BYTES + 1,
      isTruncated: true,
    });
  });
});
