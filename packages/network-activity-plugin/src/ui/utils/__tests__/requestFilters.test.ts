import { describe, expect, it } from 'vitest';
import { createDefaultFilter } from '../../state/filter';
import type { FilterState } from '../../state/filter';
import type { ProcessedRequest } from '../../state/model';
import { matchesRequestFilter } from '../requestFilters';

const allTypesFilter = (text: string): FilterState => ({
  ...createDefaultFilter(),
  text,
});

const request: ProcessedRequest = {
  id: 'request-1',
  type: 'http',
  name: 'https://example.com/users',
  status: 'finished',
  timestamp: 0,
  duration: 100,
  size: null,
  method: 'GET',
  httpStatus: 404,
};

describe('matchesRequestFilter', () => {
  it('matches HTTP status codes', () => {
    expect(matchesRequestFilter(request, allTypesFilter('404'))).toBe(true);
  });

  it('ignores whitespace-only text filters', () => {
    expect(matchesRequestFilter(request, allTypesFilter('   '))).toBe(true);
  });
});
