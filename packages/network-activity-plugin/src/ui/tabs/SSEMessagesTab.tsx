import { useState, useMemo } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ScrollArea } from '../components/ScrollArea';
import { JsonTree } from '../components/JsonTree';
import { SSENetworkEntry } from '../state/model';

export type SSEMessagesTabProps = {
  selectedRequest: SSENetworkEntry;
};

interface SSEMessageRow {
  id: string;
  type: string;
  data: string;
  timestamp: number;
}

const columnHelper = createColumnHelper<SSEMessageRow>();

const formatPreviewData = (data: string) => {
  return (
    <span className="max-w-xs truncate text-muted">
      {data.substring(0, 100) + (data.length > 100 ? '...' : '')}
    </span>
  );
};

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const timeString = date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
  return `${timeString}.${milliseconds}`;
};

const columns = [
  columnHelper.accessor('timestamp', {
    header: 'Timestamp',
    cell: ({ getValue }) => (
      <div className="text-muted">{formatTimestamp(getValue())}</div>
    ),
    size: 120,
  }),
  columnHelper.accessor('type', {
    header: 'Type',
    cell: ({ getValue }) => (
      <div className="text-purple-400 font-medium">{getValue()}</div>
    ),
    size: 100,
  }),
  columnHelper.accessor('data', {
    header: 'Data',
    cell: ({ getValue }) => {
      const data = getValue();
      return formatPreviewData(data);
    },
    size: 300,
  }),
];

export const SSEMessagesTab = ({ selectedRequest }: SSEMessagesTabProps) => {
  // Capture the selected message, so when it gets removed (message limit), it's still displayed
  const [selectedMessage, setSelectedMessage] = useState<SSEMessageRow | null>(
    null
  );

  const formatData = (data: string) => {
    if (typeof data === 'string') {
      try {
        const jsonData = JSON.parse(data);
        return (
          <div className="bg-surface p-3 rounded border border-border/60">
            <JsonTree data={jsonData} />
          </div>
        );
      } catch {
        // Fallback to pre tag if JSON parsing fails
        return (
          <pre className="text-sm font-mono text-foreground/70 whitespace-pre-wrap bg-surface p-3 rounded border border-border/60 overflow-x-auto">
            {data}
          </pre>
        );
      }
    }

    return 'Invalid data';
  };

  const tableData = useMemo(() => {
    return selectedRequest.messages.map(
      (message): SSEMessageRow => ({
        id: message.id,
        type: message.type,
        data: message.data,
        timestamp: message.timestamp,
      })
    );
  }, [selectedRequest.messages]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (selectedRequest.messages.length === 0) {
    return (
      <ScrollArea className="h-full min-h-0 p-4">
        <div className="text-sm text-muted">
          No SSE messages available for this connection. Messages will appear
          here when the SSE connection receives data.
        </div>
      </ScrollArea>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Messages Table */}
      <div className="flex-1 border border-border/60 rounded overflow-hidden">
        <div className="overflow-y-auto h-full">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border/60 sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="text-left p-2 font-medium text-foreground/70"
                      style={{ width: header.getSize() }}
                    >
                      <div className="flex items-center gap-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
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
                  className={`border-b border-border/60 hover:bg-surface cursor-pointer ${
                    selectedMessage?.id === row.original.id ? 'bg-surface' : ''
                  }`}
                  onClick={() => setSelectedMessage(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="p-2"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Message Details Panel */}
      {selectedMessage && (
        <div className="border-t border-border/60 bg-surface">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-foreground/70">
                Message Details
              </h4>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-muted hover:text-accent text-sm"
              >
                Close
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted">Type: </span>
                  <span className="text-purple-400">
                    {selectedMessage.type}
                  </span>
                </div>
                <div>
                  <span className="text-muted">Timestamp: </span>
                  <span className="text-foreground/70">
                    {formatTimestamp(selectedMessage.timestamp)}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-muted text-sm">Content:</span>
                <div className="mt-2 max-h-96 overflow-y-auto">
                  {formatData(selectedMessage.data)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
