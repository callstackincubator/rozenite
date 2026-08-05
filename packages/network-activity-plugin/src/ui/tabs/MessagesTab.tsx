import { useState, useMemo } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ScrollArea } from '../components/ScrollArea';
import { JsonTree } from '../components/JsonTree';
import { WebSocketMessageType } from '../../shared/websocket-events';
import { WebSocketNetworkEntry } from '../state/model';
import { useWebSocketMessages } from '../state/hooks';

export type MessagesTabProps = {
  selectedRequest: WebSocketNetworkEntry;
};

interface WebSocketMessageRow {
  id: string;
  direction: 'sent' | 'received';
  data: string;
  messageType: 'text' | 'binary';
  timestamp: number;
}

const columnHelper = createColumnHelper<WebSocketMessageRow>();

export const MessagesTab = ({ selectedRequest }: MessagesTabProps) => {
  const websocketMessages = useWebSocketMessages(selectedRequest.id);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null
  );

  const selectedMessage = useMemo(() => {
    if (!selectedMessageId) return null;
    return (
      websocketMessages.find((msg) => msg.id === selectedMessageId) || null
    );
  }, [selectedMessageId, websocketMessages]);

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

  const formatData = (data: string, messageType: WebSocketMessageType) => {
    if (messageType === 'binary') {
      return 'Binary message';
    }

    if (typeof data === 'string') {
      try {
        const jsonData = JSON.parse(data);
        return (
          <div className="bg-gray-800 p-3 rounded border border-gray-700">
            <JsonTree data={jsonData} />
          </div>
        );
      } catch {
        // Fallback to pre tag if JSON parsing fails
        return (
          <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded border border-gray-700 overflow-x-auto">
            {data}
          </pre>
        );
      }
    }

    return 'Binary message';
  };

  const getMessageTypeColor = (type: 'sent' | 'received') => {
    return type === 'sent' ? 'text-blue-400' : 'text-green-400';
  };

  const getMessageTypeIcon = (type: 'sent' | 'received') => {
    return type === 'sent' ? '↑' : '↓';
  };

  const tableData = useMemo(() => {
    return websocketMessages.map(
      (message): WebSocketMessageRow => ({
        id: message.id,
        direction: message.direction,
        data: message.data,
        messageType: message.messageType,
        timestamp: message.timestamp,
      })
    );
  }, [websocketMessages]);

  const formatPreviewData = (
    data: string,
    messageType: WebSocketMessageType
  ) => {
    if (messageType === 'binary') {
      return <span className="text-gray-400">Binary message</span>;
    }

    return (
      <span className="max-w-xs truncate text-gray-400">
        {data.substring(0, 100) + (data.length > 100 ? '...' : '')}
      </span>
    );
  };

  const columns = [
    columnHelper.accessor('direction', {
      header: 'Type',
      cell: ({ getValue }) => {
        const direction = getValue();
        return (
          <span
            className={`flex items-center gap-1 ${getMessageTypeColor(
              direction
            )}`}
          >
            <span className="text-xs">{getMessageTypeIcon(direction)}</span>
            <span className="capitalize">{direction}</span>
          </span>
        );
      },
      size: 80,
    }),
    columnHelper.accessor('data', {
      header: 'Data',
      cell: ({ getValue, row }) => {
        const data = getValue();
        const messageType = row.original.messageType;
        return formatPreviewData(data, messageType);
      },
      size: 300,
    }),
    columnHelper.accessor('timestamp', {
      header: 'Timestamp',
      cell: ({ getValue }) => (
        <div className="text-gray-400">{formatTimestamp(getValue())}</div>
      ),
      size: 120,
    }),
  ];

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (websocketMessages.length === 0) {
    return (
      <ScrollArea className="h-full min-h-0 p-4">
        <div className="text-sm text-gray-400">
          No WebSocket messages available for this connection. Messages will
          appear here when the WebSocket connection sends or receives data.
        </div>
      </ScrollArea>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Messages Table */}
      <div className="flex-1 border border-gray-700 rounded overflow-hidden">
        <div className="overflow-y-auto h-full">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="text-left p-2 font-medium text-gray-300"
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
                  className={`border-b border-gray-700 hover:bg-gray-800 cursor-pointer ${
                    selectedMessageId === row.original.id ? 'bg-gray-800' : ''
                  }`}
                  onClick={() => setSelectedMessageId(row.original.id)}
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
        <div className="border-t border-gray-700 bg-gray-800">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-300">
                Message Details
              </h4>
              <button
                onClick={() => setSelectedMessageId(null)}
                className="text-gray-400 hover:text-blue-400 text-sm"
              >
                Close
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Type: </span>
                  <span
                    className={getMessageTypeColor(selectedMessage.direction)}
                  >
                    {selectedMessage.direction}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Message Type: </span>
                  <span className="text-blue-400 capitalize">
                    {selectedMessage.messageType}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Timestamp: </span>
                  <span className="text-gray-300">
                    {formatTimestamp(selectedMessage.timestamp)}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Content:</span>
                <div className="mt-2 max-h-96 overflow-y-auto">
                  {formatData(
                    selectedMessage.data,
                    selectedMessage.messageType
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
