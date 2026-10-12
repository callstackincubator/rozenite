import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { DataTable, DescriptionList, Text } from '@rozenite/ui';
import { TabContent } from '../components/TabContent';
import {
  formatMessageTimestamp,
  MessageContent,
  MessageDetails,
} from '../components/MessageDetails';
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

export const SSEMessagesTab = ({ selectedRequest }: SSEMessagesTabProps) => {
  // Capture the selected message, so when it gets removed (message limit), it's still displayed
  const [selectedMessage, setSelectedMessage] = useState<SSEMessageRow | null>(null);

  const tableData = useMemo(() => {
    return selectedRequest.messages.map((message): SSEMessageRow => ({
      id: message.id,
      type: message.type,
      data: message.data,
      timestamp: message.timestamp,
    }));
  }, [selectedRequest.messages]);

  const selectedMessageId = selectedMessage?.id;

  const columns = useMemo(
    () => [
      columnHelper.accessor('timestamp', {
        header: 'Timestamp',
        cell: ({ getValue, row }) => (
          <>
            {row.original.id === selectedMessageId && <span data-row-selected hidden />}
            <Text variant="numeric" className="text-muted-foreground">
              {formatMessageTimestamp(getValue())}
            </Text>
          </>
        ),
        enableSorting: false,
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        cell: ({ getValue }) => (
          <Text variant="code" tone="info">
            {getValue()}
          </Text>
        ),
        enableSorting: false,
      }),
      columnHelper.accessor('data', {
        header: 'Data',
        cell: ({ getValue }) => (
          <Text variant="code" className="block truncate text-muted-foreground">
            {getValue().substring(0, 100) + (getValue().length > 100 ? '...' : '')}
          </Text>
        ),
        enableSorting: false,
      }),
    ],
    [selectedMessageId],
  );

  if (selectedRequest.messages.length === 0) {
    return (
      <TabContent>
        <Text variant="caption">
          No SSE messages available for this connection. Messages will appear here when the SSE
          connection receives data.
        </Text>
      </TabContent>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DataTable
          ariaLabel="SSE messages"
          className="network-selectable-table network-sse-table"
          columns={columns}
          data={tableData}
          getRowId={(row) => row.id}
          onRowClick={(row) => setSelectedMessage(row)}
        />
      </div>

      {selectedMessage && (
        <MessageDetails
          onClose={() => setSelectedMessage(null)}
          content={<MessageContent data={selectedMessage.data} />}
        >
          <DescriptionList.Item label="Type">
            <Text variant="code" tone="info">
              {selectedMessage.type}
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
