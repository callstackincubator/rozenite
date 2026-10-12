import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createColumnHelper, type ColumnSizingState, type OnChangeFn } from '@tanstack/react-table';
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
import { formatClockTime, parseUrl } from '../utils/memoized';
import { keepColumnFillBase, withColumnFill } from '../utils/columnFill';

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

const formatStartTime = (startTime: number): string => formatClockTime(startTime);

const extractDomainAndPath = (url: string): { domain: string; path: string } => {
  const parsed = parseUrl(url);

  if (!parsed) {
    return { domain: 'unknown', path: url };
  }

  const { hostname, pathname, search, hash, port } = parsed;

  return {
    domain: `${hostname}${port ? `:${port}` : ''}`,
    path: `${pathname}${search}${hash}`,
  };
};

const generateName = (url: string, showEntirePathName = false): string => {
  const parsed = parseUrl(url);

  if (!parsed) {
    return url;
  }

  const filename = showEntirePathName ? undefined : parsed.pathname.split('/').pop();

  return filename || parsed.pathname || parsed.hostname;
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

// Column widths in px when nobody has resized them. Name takes whatever width the pane has left
// over (see `withColumnFill`), so its size here is the least it keeps.
const COLUMN_SIZES = {
  timestamp: 124,
  name: 160,
  status: 84,
  method: 88,
  domain: 100,
  size: 76,
  time: 76,
};
const FILL_COLUMN_ID = 'name';

const columnHelper = createColumnHelper<RequestRow>();

// Sizes and times sort on the numbers behind them, not on the formatted text.
const columns: DataTableColumn<RequestRow>[] = [
  columnHelper.accessor('timestamp', {
    header: 'Start Time',
    size: COLUMN_SIZES.timestamp,
    minSize: 116,
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
    size: COLUMN_SIZES.name,
    minSize: COLUMN_SIZES.name,
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
    size: COLUMN_SIZES.status,
    minSize: 84,
    maxSize: 160,
    cell: ({ getValue }) => (
      <Text variant="numeric" className={getStatusTextClassName(getValue())}>
        {getValue()}
      </Text>
    ),
    sortingFn: 'basic',
  }),
  columnHelper.accessor('method', {
    header: 'Method',
    size: COLUMN_SIZES.method,
    minSize: 88,
    maxSize: 160,
    cell: ({ getValue }) => <Text variant="code">{getValue()}</Text>,
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('domain', {
    header: 'Domain',
    size: COLUMN_SIZES.domain,
    minSize: 80,
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
    size: COLUMN_SIZES.size,
    minSize: 72,
    maxSize: 160,
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
    size: COLUMN_SIZES.time,
    minSize: 72,
    maxSize: 160,
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
  // Column widths live here, not in the table: the list stays mounted while the side panel opens
  // and closes, so a width set once holds for the whole session. `columnSizing` is what people
  // have set; the table is laid out with `laidOutSizing`, which also lets Name fill the pane.
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [paneWidth, setPaneWidth] = useState(0);
  const paneRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const pane = paneRef.current;

    if (!pane) {
      return;
    }

    // The width the table can use is the scroller's, which leaves out its vertical scrollbar.
    const scroller = pane.querySelector<HTMLElement>('[data-virtuoso-scroller="true"]');
    const measure = () => setPaneWidth((scroller ?? pane).clientWidth);
    const observer = new ResizeObserver(measure);

    measure();
    observer.observe(pane);

    if (scroller) {
      observer.observe(scroller);
    }

    return () => observer.disconnect();
  }, []);

  const laidOutSizing = useMemo(
    () =>
      withColumnFill({
        fillId: FILL_COLUMN_ID,
        sizing: columnSizing,
        defaultSizes: COLUMN_SIZES,
        paneWidth,
      }),
    [columnSizing, paneWidth],
  );

  const handleSizingChange: OnChangeFn<ColumnSizingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(laidOutSizing) : updater;

    setColumnSizing((previous) =>
      keepColumnFillBase({ fillId: FILL_COLUMN_ID, previous, laidOut: laidOutSizing, next }),
    );
  };

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
    <div ref={paneRef} className="min-h-0 flex-1">
      <VirtualizedDataTable
        ariaLabel="Requests"
        className="network-request-table"
        style={{ height: '100%' }}
        data={rows}
        columns={columns}
        getRowId={(request) => request.id}
        getRowTextValue={(request) => `${request.method} ${request.name}`}
        columnResizing={{ sizing: laidOutSizing, onSizingChange: handleSizingChange }}
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
