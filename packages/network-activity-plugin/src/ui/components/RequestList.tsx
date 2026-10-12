import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import {
  Badge,
  EmptyState,
  Search,
  Text,
  VirtualizedDataTable,
  type DataTableColumn,
} from '@rozenite/ui';
import type { ProcessedRequest } from '../state/model';
import type { NetworkEventSource, RequestId, RequestOverride } from '../../shared/client';
import {
  useNetworkActivityActions,
  useOverrides,
  useSelectedRequestId,
  useClientUISettings,
} from '../state/hooks';
import { getStatusTextClassName } from '../utils/getStatusTone';
import { isNumber } from '../../utils/typeChecks';

type NetworkRequest = {
  id: RequestId;
  name: string;
  status: string | number;
  statusCode?: number;
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
  timestamp: number;
  hasOverride: boolean;
};

type RequestRow = NetworkRequest & { isSelected: boolean };

const getSourceLabel = (source?: NetworkEventSource) => {
  if (source === 'nitro') {
    return 'Nitro';
  }

  if (source === 'builtin') {
    return 'Built-in';
  }

  if (source === 'expo') {
    return 'Expo';
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

const extractDomainAndPath = (url: string): { domain: string; path: string } => {
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
      const percentage = Math.round((request.progress.loaded / request.progress.total) * 100);
      statusDisplay = `${percentage}%`;
    }

    return {
      id: request.id,
      name: generateName(request.name, showEntirePathAsName),
      status: statusDisplay,
      statusCode: request.httpStatus || undefined,
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
      timestamp: request.timestamp,
      hasOverride,
    };
  });
};

const columnHelper = createColumnHelper<RequestRow>();

// Sizes and times sort on the numbers behind them, not on the formatted text.
const columns: DataTableColumn<RequestRow>[] = [
  columnHelper.accessor('timestamp', {
    header: 'Start Time',
    cell: ({ row }) => (
      <>
        {row.original.isSelected && <span data-row-selected hidden />}
        <Text variant="numeric" className="text-muted-foreground">
          {row.original.startTime}
        </Text>
      </>
    ),
    sortingFn: 'basic',
  }),
  columnHelper.accessor('name', {
    header: 'Name',
    cell: ({ row, getValue }) => {
      const sourceLabel = getSourceLabel(row.original.source);

      return (
        <div className="flex min-w-0 items-center gap-2" title={row.original.path}>
          <span className="truncate text-sm">{getValue()}</span>

          {row.original.hasOverride && (
            <span
              role="img"
              aria-label="Response overridden"
              className="size-1.5 shrink-0 bg-primary"
            />
          )}

          {sourceLabel && (
            <Badge tone="neutral" variant="soft" size="sm">
              {sourceLabel}
            </Badge>
          )}
        </div>
      );
    },
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => (
      <Text variant="numeric" className={getStatusTextClassName(getValue())}>
        {getValue()}
      </Text>
    ),
    sortingFn: 'basic',
  }),
  columnHelper.accessor('method', {
    header: 'Method',
    cell: ({ getValue }) => <Text variant="code">{getValue()}</Text>,
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('domain', {
    header: 'Domain',
    cell: ({ getValue }) => (
      <Text variant="code" className="block truncate text-muted-foreground">
        {getValue()}
      </Text>
    ),
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor((request) => request.sizeBytes ?? -1, {
    id: 'size',
    header: 'Size',
    cell: ({ row }) => (
      <Text variant="numeric" className="whitespace-nowrap text-muted-foreground">
        {row.original.size}
      </Text>
    ),
    sortingFn: 'basic',
  }),
  columnHelper.accessor('durationMs', {
    id: 'time',
    header: 'Time',
    cell: ({ row }) => (
      <Text variant="numeric" className="whitespace-nowrap text-muted-foreground">
        {row.original.time}
      </Text>
    ),
    sortingFn: 'basic',
  }),
];

export type RequestListProps = {
  requests: ProcessedRequest[];
  /** What to say when there is nothing to list. */
  emptyState?: { title: string; description?: string };
};

const DEFAULT_EMPTY_STATE = {
  title: 'No requests yet',
  description: 'Requests show up here as the app makes them.',
};

export const RequestList = ({
  requests: filteredRequests,
  emptyState = DEFAULT_EMPTY_STATE,
}: RequestListProps) => {
  const actions = useNetworkActivityActions();
  const selectedRequestId = useSelectedRequestId();
  const overrides = useOverrides();
  const clientUISettings = useClientUISettings();

  const requests = useMemo(() => {
    return processNetworkRequests(filteredRequests, overrides, clientUISettings?.showUrlAsName);
  }, [filteredRequests, overrides, clientUISettings?.showUrlAsName]);

  const rows = useMemo(
    () =>
      requests.map((request): RequestRow => ({
        ...request,
        isSelected: request.id === selectedRequestId,
      })),
    [requests, selectedRequestId],
  );

  const onRequestSelect = (request: RequestRow): void => {
    actions.setSelectedRequest(request.id);
  };

  return (
    <div className="min-h-0 flex-1">
      <VirtualizedDataTable
        ariaLabel="Requests"
        className="network-request-table"
        style={{ height: '100%' }}
        data={rows}
        columns={columns}
        getRowId={(request) => request.id}
        getRowTextValue={(request) => `${request.method} ${request.name}`}
        onRowClick={onRequestSelect}
        renderEmptyState={() => (
          <EmptyState
            icon={Search}
            title={emptyState.title}
            description={emptyState.description}
            className="min-h-56"
          />
        )}
      />
    </div>
  );
};

export {
  formatSize,
  formatDuration,
  formatStartTime,
  extractDomainAndPath,
  generateName,
  processNetworkRequests,
};
