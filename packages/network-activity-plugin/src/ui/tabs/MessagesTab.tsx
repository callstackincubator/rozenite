import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Badge, DataTable, DescriptionList, Text } from '@rozenite/ui';
import { TabContent } from '../components/TabContent';
import {
  formatMessageTimestamp,
  MessageContent,
  MessageDetails,
} from '../components/MessageDetails';
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

const DirectionLabel = ({ direction }: { direction: WebSocketMessageRow['direction'] }) => {
  const Icon = direction === 'sent' ? ArrowUp : ArrowDown;

  return (
    <span className="flex items-center gap-1.5">
      <Icon className="size-3 shrink-0 text-faint" />
      <Text variant="code" tone={direction === 'sent' ? 'info' : 'success'} className="capitalize">
        {direction}
      </Text>
    </span>
  );
};

export const MessagesTab = ({ selectedRequest }: MessagesTabProps) => {
  const websocketMessages = useWebSocketMessages(selectedRequest.id);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const selectedMessage = useMemo(() => {
    if (!selectedMessageId) return null;
    return websocketMessages.find((msg) => msg.id === selectedMessageId) || null;
  }, [selectedMessageId, websocketMessages]);

  const tableData = useMemo(() => {
    return websocketMessages.map((message): WebSocketMessageRow => ({
      id: message.id,
      direction: message.direction,
      data: message.data,
      messageType: message.messageType,
      timestamp: message.timestamp,
    }));
  }, [websocketMessages]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('direction', {
        header: 'Type',
        cell: ({ getValue, row }) => (
          <>
            {row.original.id === selectedMessageId && <span data-row-selected hidden />}
            <DirectionLabel direction={getValue()} />
          </>
        ),
        enableSorting: false,
      }),
      columnHelper.accessor('data', {
        header: 'Data',
        cell: ({ getValue, row }) => (
          <Text variant="code" className="block truncate text-muted-foreground">
            {row.original.messageType === 'binary'
              ? 'Binary message'
              : getValue().substring(0, 100) + (getValue().length > 100 ? '...' : '')}
          </Text>
        ),
        enableSorting: false,
      }),
      columnHelper.accessor('timestamp', {
        header: 'Timestamp',
        cell: ({ getValue }) => (
          <Text variant="numeric" className="text-muted-foreground">
            {formatMessageTimestamp(getValue())}
          </Text>
        ),
        enableSorting: false,
      }),
    ],
    [selectedMessageId],
  );

  if (websocketMessages.length === 0) {
    return (
      <TabContent>
        <Text variant="caption">
          No WebSocket messages available for this connection. Messages will appear here when the
          WebSocket connection sends or receives data.
        </Text>
      </TabContent>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DataTable
          ariaLabel="WebSocket messages"
          className="network-selectable-table network-ws-table"
          columns={columns}
          data={tableData}
          getRowId={(row) => row.id}
          onRowClick={(row) => setSelectedMessageId(row.id)}
        />
      </div>

      {selectedMessage && (
        <MessageDetails
          onClose={() => setSelectedMessageId(null)}
          content={
            selectedMessage.messageType === 'binary' ? (
              <Text variant="caption">Binary message</Text>
            ) : (
              <MessageContent data={selectedMessage.data} />
            )
          }
        >
          <DescriptionList.Item label="Type">
            <Badge
              tone={selectedMessage.direction === 'sent' ? 'info' : 'success'}
              variant="soft"
              size="sm"
            >
              {selectedMessage.direction}
            </Badge>
          </DescriptionList.Item>
          <DescriptionList.Item label="Message Type">
            <Text variant="code" className="capitalize">
              {selectedMessage.messageType}
            </Text>
          </DescriptionList.Item>
          <DescriptionList.Item label="Timestamp">
            <Text variant="numeric">{formatMessageTimestamp(selectedMessage.timestamp)}</Text>
          </DescriptionList.Item>
        </MessageDetails>
      )}
    </div>
  );
};
