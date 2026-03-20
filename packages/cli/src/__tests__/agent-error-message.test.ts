import { describe, expect, it } from 'vitest';
import { getErrorMessage } from '../commands/agent/error-message.js';

describe('agent error message', () => {
  it('extracts nested messages from AggregateError', () => {
    const error = new AggregateError([
      new Error('connect ECONNREFUSED 127.0.0.1:8081'),
    ], '');

    expect(getErrorMessage(error)).toBe('connect ECONNREFUSED 127.0.0.1:8081');
  });
});
