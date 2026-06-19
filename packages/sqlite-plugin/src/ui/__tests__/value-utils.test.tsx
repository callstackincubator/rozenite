import { JsonInspector } from '@rozenite/ui';
import { describe, expect, it } from 'vitest';
import {
  getValuePreview,
  renderStructuredValue,
  stringifyValue,
} from '../value-utils';

describe('value utils', () => {
  it('stringifyValue returns a string for undefined values', () => {
    expect(stringifyValue(undefined)).toBe('undefined');
  });

  it('getValuePreview does not crash for undefined values', () => {
    expect(getValuePreview(undefined)).toBe('undefined');
  });

  it('renderStructuredValue uses the shared JsonInspector', () => {
    const result = renderStructuredValue({ ok: true });

    expect(result?.type).toBe(JsonInspector);
    expect(result?.props.data).toEqual({ ok: true });
  });
});
