import { describe, expect, it } from 'vitest';
import { buildDocumentTitle } from './document-title';

describe('buildDocumentTitle', () => {
  it('names the framework and the device in front of the product name', () => {
    expect(buildDocumentTitle({ framework: 'Lynx', targetName: 'Pixel 8' })).toBe(
      'Lynx · Pixel 8 - Rozenite',
    );
  });

  it('drops the framework until the target has reported one', () => {
    expect(buildDocumentTitle({ framework: null, targetName: 'Pixel 8' })).toBe(
      'Pixel 8 - Rozenite',
    );
  });

  it('drops the device name while it is still unknown', () => {
    expect(buildDocumentTitle({ framework: 'React Native', targetName: '' })).toBe(
      'React Native - Rozenite',
    );
  });

  it('falls back to the bare product name, never a stray separator', () => {
    expect(buildDocumentTitle({ framework: null, targetName: '' })).toBe('Rozenite');
  });
});
