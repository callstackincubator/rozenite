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
import { ProcessedRequest } from '../state/model';
import { RequestId } from '../../shared/client';
import {
  useNetworkActivityActions,
  useProcessedRequests,
  useSelectedRequestId,
} from '../state/hooks';
import { getStatusColor } from '../utils/getStatusColor';
import { FilterState } from './FilterBar';

type NetworkRequest = {
  id: RequestId;
  name: string;
  status: string | number;
  method: string;
  domain: string;
  path: string;
  size: string;
  time: string;
  type: string;
  startTime: string;
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
  url: string
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

const generateName = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
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

const processNetworkRequests = (
  processedRequests: ProcessedRequest[]
): NetworkRequest[] => {
  return processedRequests.map((request): NetworkRequest => {
    const { domain, path } = extractDomainAndPath(request.name);
    const duration = request.duration || 0;

    return {
      id: request.id,
      name: generateName(request.name),
      status: request.httpStatus || request.status,
      method: request.method,
      domain,
      path,
      size: formatSize(request.size || 0),
      time: formatDuration(duration),
      type: request.type,
      startTime: formatStartTime(request.timestamp),
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
    cell: ({ getValue }) => (
      <div className="flex-1 min-w-0 truncate">{getValue()}</div>
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
    cell: ({ getValue }) => <div className="text-gray-300">{getValue()}</div>,
    size: 80,
    sortingFn: sortSize,
  }),
  columnHelper.accessor('time', {
    header: 'Time',
    cell: ({ getValue }) => <div className="text-gray-300">{getValue()}</div>,
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

  // Filter requests based on current filter state
  const filteredRequests = useMemo(() => {
    return processedRequests.filter((request) => {
      // Type filter
      if (!filter.types.has(request.type)) {
        return false;
      }

      // Text filter
      if (filter.text) {
        const searchText = filter.text.toLowerCase();
        const searchableFields = [
          request.name,
          request.method,
          request.status.toString(),
        ]
          .join(' ')
          .toLowerCase();

        return searchableFields.includes(searchText);
      }

      return true;
    });
  }, [processedRequests, filter]);

  const requests = useMemo(() => {
    return processNetworkRequests(filteredRequests);
  }, [filteredRequests]);

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
                          header.getContext()
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
