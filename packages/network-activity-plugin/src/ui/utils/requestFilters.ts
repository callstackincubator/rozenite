import type { FilterState } from '../state/filter';
import type { ProcessedRequest } from '../state/model';
import type { HttpMethod } from '../../shared/client';

export type RequestFilterOptions = {
  hasOverride?: boolean;
};

const parseThreshold = (value: string): number | null => {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const matchesStatusFilter = (
  statusCode: number | undefined,
  statusFilter: string,
) => {
  const normalizedFilter = statusFilter.trim().toLowerCase();
  if (!normalizedFilter) {
    return true;
  }

  if (statusCode === undefined) {
    return false;
  }

  const statusRangeMatch = normalizedFilter.match(/^(\d{3})\s*-\s*(\d{3})$/);
  if (statusRangeMatch) {
    const min = Number(statusRangeMatch[1]);
    const max = Number(statusRangeMatch[2]);
    return statusCode >= min && statusCode <= max;
  }

  const statusClassMatch = normalizedFilter.match(/^([1-5])xx$/);
  if (statusClassMatch) {
    return Math.floor(statusCode / 100) === Number(statusClassMatch[1]);
  }

  const comparisonMatch = normalizedFilter.match(/^(>=|<=|>|<)\s*(\d{3})$/);
  if (comparisonMatch) {
    const value = Number(comparisonMatch[2]);
    switch (comparisonMatch[1]) {
      case '>=':
        return statusCode >= value;
      case '<=':
        return statusCode <= value;
      case '>':
        return statusCode > value;
      case '<':
        return statusCode < value;
    }
  }

  return statusCode === Number(normalizedFilter);
};

const isInFlightStatus = (status: ProcessedRequest['status']) => {
  return ['pending', 'loading', 'connecting', 'open'].includes(status);
};

const isFailedStatus = (status: ProcessedRequest['status']) => {
  return ['failed', 'error'].includes(status);
};

const isHttpMethod = (
  method: ProcessedRequest['method'],
): method is HttpMethod => method !== 'WS' && method !== 'SSE';

const extractDomainAndPath = (url: string) => {
  try {
    const { hostname, pathname, search, hash, port } = new URL(url);

    return {
      domain: `${hostname}${port ? `:${port}` : ''}`,
      path: `${pathname}${search}${hash}`,
    };
  } catch {
    return { domain: 'unknown', path: url };
  }
};

export const matchesRequestFilter = (
  request: ProcessedRequest,
  filter: FilterState,
  options: RequestFilterOptions = {},
) => {
  if (filter.types.size > 0 && !filter.types.has(request.type)) {
    return false;
  }

  if (
    filter.advanced.methods.size > 0 &&
    (!isHttpMethod(request.method) ||
      !filter.advanced.methods.has(request.method))
  ) {
    return false;
  }

  if (
    filter.advanced.sources.size > 0 &&
    (!request.source || !filter.advanced.sources.has(request.source))
  ) {
    return false;
  }

  if (!matchesStatusFilter(request.httpStatus, filter.advanced.status)) {
    return false;
  }

  const { domain, path } = extractDomainAndPath(request.name);
  const domainFilter = filter.advanced.domain.trim().toLowerCase();
  if (domainFilter && !domain.toLowerCase().includes(domainFilter)) {
    return false;
  }

  const contentTypeFilter = filter.advanced.contentType.trim().toLowerCase();
  if (
    contentTypeFilter &&
    !request.contentType?.toLowerCase().includes(contentTypeFilter)
  ) {
    return false;
  }

  if (filter.advanced.failedOnly && !isFailedStatus(request.status)) {
    return false;
  }

  if (filter.advanced.inFlightOnly && !isInFlightStatus(request.status)) {
    return false;
  }

  if (filter.advanced.overriddenOnly && !options.hasOverride) {
    return false;
  }

  const minSize = parseThreshold(filter.advanced.minSize);
  if (minSize !== null && (request.size === null || request.size < minSize)) {
    return false;
  }

  const maxSize = parseThreshold(filter.advanced.maxSize);
  if (maxSize !== null && (request.size === null || request.size > maxSize)) {
    return false;
  }

  const duration = request.duration || 0;
  const minDuration = parseThreshold(filter.advanced.minDuration);
  if (minDuration !== null && duration < minDuration) {
    return false;
  }

  const maxDuration = parseThreshold(filter.advanced.maxDuration);
  if (maxDuration !== null && duration > maxDuration) {
    return false;
  }

  const searchText = filter.text.trim().toLowerCase();
  if (!searchText) {
    return true;
  }

  const searchableFields = [
    request.name,
    request.method,
    request.status,
    request.httpStatus,
    request.source,
    request.type,
    request.contentType,
    domain,
    path,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join(' ')
    .toLowerCase();

  return searchableFields.includes(searchText);
};
