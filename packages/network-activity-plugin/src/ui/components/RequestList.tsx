import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingFn,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import type { ProcessedRequest } from '../state/model';
import type {
  HttpMethod,
  NetworkEventSource,
  RequestId,
  RequestOverride,
} from '../../shared/client';
import {
  useNetworkActivityActions,
  useOverrides,
  useProcessedRequests,
  useSelectedRequestId,
  useClientUISettings,
} from '../state/hooks';
import { getStatusColor } from '../utils/getStatusColor';
import { FilterState } from './FilterBar';
import { isNumber } from '../../utils/typeChecks';

type NetworkRequest = {
  id: RequestId;
  name: string;
  status: string | number;
  statusCode?: number;
  statusState: ProcessedRequest['status'];
  method: ProcessedRequest['method'];
  domain: string;
  path: string;
  contentType?: string;
  size: string;
  sizeBytes: number | null;
  time: string;
  durationMs: number;
  type: ProcessedRequest['type'];
  source?: NetworkEventSource;
  startTime: string;
  hasOverride: boolean;
};

const getSourceLabel = (source?: NetworkEventSource) => {
  if (source === 'nitro') {
    return 'Nitro';
  }

  if (source === 'builtin') {
    return 'Built-in';
  }

  return null;
};

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'kB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDuration = (duration: number): string => {
  if (duration < 1000) return `${Math.round(duration)} ms`;
  return `${(duration / 1000).toFixed(1)} s`;
};

const formatStartTime = (startTime: number): string => {
  const date = new Date(startTime);
  const timeString = date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
  return `${timeString}.${milliseconds}`;
};

const extractDomainAndPath = (
  url: string,
): { domain: string; path: string } => {
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

const generateName = (url: string, showEntirePathName = false): string => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = showEntirePathName ? undefined : pathname.split('/').pop();

    return filename || pathname || urlObj.hostname;
  } catch {
    return url;
  }
};

const sortSize: SortingFn<NetworkRequest> = (rowA, rowB, columnId) => {
  const a = rowA.getValue(columnId) as string;
  const b = rowB.getValue(columnId) as string;

  // Extract numeric values from formatted strings like "1.2 kB", "500 B", etc.
  const getNumericValue = (str: string) => {
    const match = str.match(/^([\d.]+)\s*([KMGT]?B)$/);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      B: 1,
      kB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
    };
    return value * (multipliers[unit] || 1);
  };

  return getNumericValue(a) - getNumericValue(b);
};

const sortTime: SortingFn<NetworkRequest> = (rowA, rowB, columnId) => {
  const a = rowA.getValue(columnId) as string;
  const b = rowB.getValue(columnId) as string;

  // Extract numeric values from formatted strings like "150 ms", "1.2 s", etc.
  const getNumericValue = (str: string) => {
    const match = str.match(/^([\d.]+)\s*(ms|s)$/);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2];
    return unit === 's' ? value * 1000 : value;
  };

  return getNumericValue(a) - getNumericValue(b);
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

const isInFlightStatus = (status: string) => {
  return ['pending', 'loading', 'connecting', 'open'].includes(status);
};

const isFailedStatus = (status: string) => {
  return ['failed', 'error'].includes(status);
};

const isHttpMethod = (method: NetworkRequest['method']): method is HttpMethod =>
  method !== 'WS' && method !== 'SSE';

const filterNetworkRequests = (
  requests: NetworkRequest[],
  filter: FilterState,
) => {
  const searchText = filter.text.trim().toLowerCase();
  const domainFilter = filter.advanced.domain.trim().toLowerCase();
  const contentTypeFilter = filter.advanced.contentType.trim().toLowerCase();
  const minSize = parseThreshold(filter.advanced.minSize);
  const maxSize = parseThreshold(filter.advanced.maxSize);
  const minDuration = parseThreshold(filter.advanced.minDuration);
  const maxDuration = parseThreshold(filter.advanced.maxDuration);

  return requests.filter((request) => {
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

    if (!matchesStatusFilter(request.statusCode, filter.advanced.status)) {
      return false;
    }

    if (domainFilter && !request.domain.toLowerCase().includes(domainFilter)) {
      return false;
    }

    if (
      contentTypeFilter &&
      !request.contentType?.toLowerCase().includes(contentTypeFilter)
    ) {
      return false;
    }

    if (filter.advanced.failedOnly && !isFailedStatus(request.statusState)) {
      return false;
    }

    if (
      filter.advanced.inFlightOnly &&
      !isInFlightStatus(request.statusState)
    ) {
      return false;
    }

    if (filter.advanced.overriddenOnly && !request.hasOverride) {
      return false;
    }

    if (
      minSize !== null &&
      (request.sizeBytes === null || request.sizeBytes < minSize)
    ) {
      return false;
    }

    if (
      maxSize !== null &&
      (request.sizeBytes === null || request.sizeBytes > maxSize)
    ) {
      return false;
    }

    if (minDuration !== null && request.durationMs < minDuration) {
      return false;
    }

    if (maxDuration !== null && request.durationMs > maxDuration) {
      return false;
    }

    if (searchText) {
      const searchableFields = [
        request.name,
        request.method,
        request.status,
        request.domain,
        request.path,
        request.source,
        request.type,
        request.contentType,
      ]
        .join(' ')
        .toLowerCase();

      return searchableFields.includes(searchText);
    }

    return true;
  });
};

const processNetworkRequests = (
  processedRequests: ProcessedRequest[],
  overrides: Map<string, RequestOverride>,
  showEntirePathAsName = false,
): NetworkRequest[] => {
  return processedRequests.map((request): NetworkRequest => {
    const { domain, path } = extractDomainAndPath(request.name);
    const duration = request.duration || 0;
    const hasOverride = overrides.has(request.name);

    let statusDisplay: string | number = request.httpStatus || request.status;
    if (request.status === 'loading' && request.progress?.lengthComputable) {
      const percentage = Math.round(
        (request.progress.loaded / request.progress.total) * 100,
      );
      statusDisplay = `${percentage}%`;
    }

    return {
      id: request.id,
      name: generateName(request.name, showEntirePathAsName),
      status: statusDisplay,
      statusCode: request.httpStatus || undefined,
      statusState: request.status,
      method: request.method,
      domain,
      path,
      contentType: request.contentType,
      size: isNumber(request.size) ? formatSize(request.size) : '—',
      sizeBytes: isNumber(request.size) ? request.size : null,
      time: formatDuration(duration),
      durationMs: duration,
      type: request.type,
      source: request.source,
      startTime: formatStartTime(request.timestamp),
      hasOverride: hasOverride,
    };
  });
};

const columnHelper = createColumnHelper<NetworkRequest>();

const columns = [
  columnHelper.accessor('startTime', {
    header: 'Start Time',
    cell: ({ getValue }) => <div className="text-gray-300">{getValue()}</div>,
    size: 120,
    sortingFn: 'basic',
  }),
  columnHelper.accessor('name', {
    header: 'Name',
    cell: ({ row, getValue }) => (
      <div className="flex-1 min-w-0 truncate" title={row.original.path}>
        {getValue()}

        {row.original.hasOverride && (
          <span className="w-2 h-2 rounded-full bg-violet-300 ms-2 inline-block"></span>
        )}

        {getSourceLabel(row.original.source) && (
          <span className="ml-2 rounded border border-gray-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-400">
            {getSourceLabel(row.original.source)}
          </span>
        )}
      </div>
    ),
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => {
      return (
        <div className={`${getStatusColor(getValue())}`}>{getValue()}</div>
      );
    },
    size: 64,
    sortingFn: 'basic',
  }),
  columnHelper.accessor('method', {
    header: 'Method',
    cell: ({ getValue }) => <div className="text-gray-300">{getValue()}</div>,
    size: 64,
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('domain', {
    header: 'Domain',
    cell: ({ getValue }) => (
      <div className="text-gray-300 truncate">{getValue()}</div>
    ),
    size: 128,
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('size', {
    header: 'Size',
    cell: ({ getValue }) => (
      <div className="text-gray-300 whitespace-nowrap">{getValue()}</div>
    ),
    size: 80,
    sortingFn: sortSize,
  }),
  columnHelper.accessor('time', {
    header: 'Time',
    cell: ({ getValue }) => (
      <div className="text-gray-300 whitespace-nowrap">{getValue()}</div>
    ),
    size: 80,
    sortingFn: sortTime,
  }),
];

export type RequestListProps = {
  filter: FilterState;
};

export const RequestList = ({ filter }: RequestListProps) => {
  const actions = useNetworkActivityActions();
  const processedRequests = useProcessedRequests();
  const selectedRequestId = useSelectedRequestId();
  const [sorting, setSorting] = useState<SortingState>([]);
  const overrides = useOverrides();
  const clientUISettings = useClientUISettings();

  const requests = useMemo(() => {
    const allRequests = processNetworkRequests(
      processedRequests,
      overrides,
      clientUISettings?.showUrlAsName,
    );
    return filterNetworkRequests(allRequests, filter);
  }, [processedRequests, overrides, clientUISettings?.showUrlAsName, filter]);

  const table = useReactTable({
    data: requests,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  const onRequestSelect = (requestId: RequestId): void => {
    actions.setSelectedRequest(requestId);
  };

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={`text-left text-xs font-medium text-gray-400 px-2 py-2 ${
                    header.column.getCanSort()
                      ? 'cursor-pointer select-none hover:bg-gray-700'
                      : ''
                  }`}
                  style={{ width: header.getSize() }}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    {header.column.getCanSort() && (
                      <span className="text-gray-500">
                        {{
                          asc: '↑',
                          desc: '↓',
                        }[header.column.getIsSorted() as string] ?? '↕'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`text-sm hover:bg-gray-800 cursor-pointer border-b border-gray-800 ${
                selectedRequestId === row.original.id ? 'bg-blue-900/30' : ''
              }`}
              onClick={() => onRequestSelect(row.original.id)}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="px-2 py-1"
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Export helper functions for use in other components
export {
  formatSize,
  formatDuration,
  formatStartTime,
  extractDomainAndPath,
  generateName,
  processNetworkRequests,
};
