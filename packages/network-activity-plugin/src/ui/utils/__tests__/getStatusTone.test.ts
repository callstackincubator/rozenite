import { describe, expect, it } from 'vitest';
import { getStatusTextClassName, getStatusTone } from '../getStatusTone';

describe('getStatusTone', () => {
  it('reads HTTP status classes', () => {
    expect(getStatusTone(200)).toBe('success');
    expect(getStatusTone(304)).toBe('warning');
    expect(getStatusTone(404)).toBe('danger');
    expect(getStatusTone(503)).toBe('danger');
    expect(getStatusTone(0)).toBe('neutral');
  });

  it('reads socket, stream and request states', () => {
    expect(getStatusTone('open')).toBe('success');
    expect(getStatusTone('connecting')).toBe('warning');
    expect(getStatusTone('closed')).toBe('danger');
    expect(getStatusTone('error')).toBe('danger');
    // A request that never got a response is a failure, not an idle one.
    expect(getStatusTone('failed')).toBe('danger');
    expect(getStatusTone('pending')).toBe('neutral');
    expect(getStatusTone('45%')).toBe('neutral');
  });

  it('maps a neutral status to muted text rather than body text', () => {
    expect(getStatusTextClassName('pending')).toBe('text-muted-foreground');
    expect(getStatusTextClassName(201)).toBe('text-success');
    expect(getStatusTextClassName(500)).toBe('text-danger');
  });
});
