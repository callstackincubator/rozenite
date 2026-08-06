import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('lets a later conflicting Tailwind class win', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('respects conditional class values', () => {
    expect(cn('text-sm', { 'text-lg': true, 'text-xs': false })).toBe('text-lg');
  });
});
