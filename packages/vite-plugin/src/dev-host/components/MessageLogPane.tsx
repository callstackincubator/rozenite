import { Button, DataTable, ScrollArea } from '@rozenite/ui';
import { Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { DataTableColumn } from '@rozenite/ui';
import type { MessageEntry } from '../types.js';
import { formatMessageTableDate, formatPayloadPreview } from '../utils.js';

type MessageLogPaneProps = {
  messages: MessageEntry[];
  onSelectMessage: (messageId: string) => void;
  onClearMessages: () => void;
};

export const MessageLogPane = ({
  messages,
  onSelectMessage,
  onClearMessages,
}: MessageLogPaneProps) => {
  const columns = useMemo<DataTableColumn<MessageEntry>[]>(
    () => [
      {
        accessorKey: 'direction',
        header: 'Dir',
        cell: ({ getValue }) => {
          const direction = getValue<MessageEntry['direction']>();
          const isSent = direction === 'in';

          return (
            <span
              className={
                isSent ? 'dev-host-direction-in' : 'dev-host-direction-out'
              }
              aria-label={isSent ? 'Sent message' : 'Received message'}
              title={isSent ? 'Sent message' : 'Received message'}
            >
              {isSent ? '↑' : '↓'}
            </span>
          );
        },
      },
      {
        accessorKey: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatMessageTableDate(row.original.date)}
          </span>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>()}</span>
        ),
      },
      {
        id: 'payload',
        accessorFn: (message) => formatPayloadPreview(message.payload),
        header: 'Payload',
        cell: ({ getValue }) => (
          <span className="block max-w-160 truncate font-mono text-xs text-muted-foreground">
            {getValue<string>()}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <section className="dev-host-pane">
      <header className="dev-host-pane-header">
        <h2 className="dev-host-pane-title">Message Log</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearMessages}
          disabled={messages.length === 0}
          aria-label="Clear message log"
          title="Clear message log"
        >
          <Trash2 />
        </Button>
      </header>

      <ScrollArea
        className="dev-host-scroll"
        viewportClassName="dev-host-scroll-viewport"
      >
        <DataTable
          className="dev-host-message-table"
          columns={columns}
          data={messages}
          emptyMessage="No messages yet."
          getRowId={(message) => message.id}
          onRowClick={(message) => onSelectMessage(message.id)}
        />
      </ScrollArea>
    </section>
  );
};
