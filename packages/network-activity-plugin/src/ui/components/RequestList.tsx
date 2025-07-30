import * as React from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { NetworkEntry } from '../types';
import { RequestId } from '../../shared/client';

type NetworkRequest = {
  id: string;
  name: string;
  status: number;
  method: string;
  domain: string;
  path: string;
  size: string;
  time: string;
  type: string;
  initiator: string;
  startTime: string;
  requestBody?: {
    type: string;
    data: string;
  };
  responseBody?: {
    type: string;
    data: string | null;
  };
};

type RequestListProps = {
  networkEntries: Map<RequestId, NetworkEntry>;
  selectedRequestId: RequestId | null;
  onRequestSelect: (requestId: RequestId) => void;
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
    const urlObj = new URL(url);
    return {
      domain: urlObj.hostname,
      path: urlObj.pathname + urlObj.search + urlObj.hash,
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

const formatInitiator = (initiator: any): string => {
  if (!initiator) return 'Other';
  if (initiator.type === 'script' && initiator.url) {
    try {
      const url = new URL(initiator.url);
      const filename = url.pathname.split('/').pop() || url.hostname;
      const line = initiator.lineNumber ? `:${initiator.lineNumber}` : '';
      return `${filename}${line}`;
    } catch {
      return 'Script';
    }
  }
  return initiator.type || 'Other';
};

const mapResourceType = (type: string): string => {
  const typeMap: Record<string, string> = {
    Document: 'document',
    Stylesheet: 'stylesheet',
    Image: 'img',
    Media: 'media',
    Font: 'font',
    Script: 'script',
    XHR: 'xhr',
    Fetch: 'xhr',
    EventSource: 'eventsource',
    WebSocket: 'websocket',
    Manifest: 'manifest',
    Other: 'other',
    Ping: 'ping',
    CSPViolationReport: 'csp',
    Preflight: 'preflight',
    Subresource: 'subresource',
  };
  return typeMap[type] || 'other';
};

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    document: 'bg-blue-600',
    script: 'bg-yellow-600',
    stylesheet: 'bg-purple-600',
    xhr: 'bg-green-600',
    img: 'bg-pink-600',
    font: 'bg-orange-600',
  };
  return colors[type] || 'bg-gray-600';
};

const getStatusColor = (status: number) => {
  if (status >= 200 && status < 300) return 'text-green-400';
  if (status >= 300 && status < 400) return 'text-yellow-400';
  if (status >= 400) return 'text-red-400';
  return 'text-gray-400';
};

// Custom sorting functions
const sortSize = (rowA: any, rowB: any, columnId: string) => {
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

const sortTime = (rowA: any, rowB: any, columnId: string) => {
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

// Convert NetworkEntry to NetworkRequest for UI display
const processNetworkEntries = (
  networkEntries: Map<RequestId, NetworkEntry>
): NetworkRequest[] => {
  return Array.from(networkEntries.values()).map((entry): NetworkRequest => {
    const { domain, path } = extractDomainAndPath(entry.url);
    const duration = entry.duration || 0;

    return {
      id: entry.requestId,
      name: generateName(entry.url),
      status: entry.response?.status || 0,
      method: entry.request?.method || 'GET',
      domain,
      path,
      size: formatSize(entry.size || 0),
      time: formatDuration(duration),
      type: mapResourceType(entry.type || 'Other'),
      initiator: formatInitiator(entry.initiator),
      startTime: formatStartTime(entry.startTime || 0),
      requestBody: entry.request?.postData
        ? {
            type: entry.request.headers['content-type'] || 'text/plain',
            data: entry.request.postData,
          }
        : undefined,
      responseBody: entry.responseBody
        ? {
            type: entry.response?.contentType || 'application/octet-stream',
            data: entry.responseBody.body,
          }
        : undefined,
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

export const RequestList: React.FC<RequestListProps> = ({
  networkEntries,
  selectedRequestId,
  onRequestSelect,
}) => {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const requests = React.useMemo(() => {
    return processNetworkEntries(networkEntries);
  }, [networkEntries]);

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
  formatInitiator,
  mapResourceType,
  getTypeColor,
  getStatusColor,
  processNetworkEntries,
};

export type { NetworkRequest };
