import type { MessageEntry } from '../types.js';
import { cn, formatMessageTableDate, formatPayloadPreview } from '../utils.js';
import { ScrollArea } from './ui/ScrollArea.js';
import { ClearIcon } from './icons.js';

type MessageLogPaneProps = {
  messages: MessageEntry[];
  selectedMessageId: string | null;
  onSelectMessage: (messageId: string) => void;
  onClearMessages: () => void;
};

export const MessageLogPane = ({
  messages,
  selectedMessageId,
  onSelectMessage,
  onClearMessages,
}: MessageLogPaneProps) => {
  return (
    <div className="rz-pane">
      <div className="rz-log-pane">
        <div className="rz-sidebar-header">
          <div className="rz-sidebar-title">Message Log</div>
          <div className="rz-header-actions">
            <button
              type="button"
              className="rz-sidebar-close"
              onClick={onClearMessages}
              disabled={messages.length === 0}
              aria-label="Clear message log"
              title="Clear message log"
            >
              <ClearIcon />
            </button>
          </div>
        </div>

        <ScrollArea className="rz-sidebar-scroll">
          <div className="rz-message-list">
            <div className="rz-message-list-header">
              <div className="rz-message-header-cell">Dir</div>
              <div className="rz-message-header-cell">Date</div>
              <div className="rz-message-header-cell">Type</div>
              <div className="rz-message-header-cell">Payload</div>
            </div>

            {messages.map((message) => (
              <button
                key={message.id}
                type="button"
                className="rz-message-row"
                data-selected={message.id === selectedMessageId}
                onClick={() => onSelectMessage(message.id)}
              >
                <div
                  className={cn(
                    'rz-message-cell rz-message-direction',
                    message.direction === 'in' ? 'rz-message-dir-in' : 'rz-message-dir-out',
                  )}
                  aria-label={message.direction === 'in' ? 'Sent message' : 'Received message'}
                  title={message.direction === 'in' ? 'Sent message' : 'Received message'}
                >
                  <span className="rz-message-arrow" aria-hidden="true">
                    {message.direction === 'in' ? '↑' : '↓'}
                  </span>
                </div>

                <div className="rz-message-cell rz-message-date">
                  {formatMessageTableDate(message.date)}
                </div>

                <div className="rz-message-cell rz-message-type">{message.type}</div>

                <pre className="rz-message-cell rz-message-preview">
                  {formatPayloadPreview(message.payload)}
                </pre>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
