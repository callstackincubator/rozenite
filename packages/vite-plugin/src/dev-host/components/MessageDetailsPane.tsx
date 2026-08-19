import { IconButton, JsonInspector, ScrollArea } from '@rozenite/ui';
import { Send, X } from 'lucide-react';
import type { MessageEntry } from '../types.js';
import { formatMessageDate, formatPayloadForCommandInput } from '../utils.js';

type MessageDetailsPaneProps = {
  selectedMessage: MessageEntry;
  onClose: () => void;
  onUseMessage: (message: MessageEntry) => void;
};

export const MessageDetailsPane = ({
  selectedMessage,
  onClose,
  onUseMessage,
}: MessageDetailsPaneProps) => {
  return (
    <section className="dev-host-pane">
      <header className="dev-host-pane-header">
        <h2 className="dev-host-pane-title">Message Details</h2>
        <div className="dev-host-pane-actions">
          <IconButton
            tone="neutral"
            variant="ghost"
            onClick={() => onUseMessage(selectedMessage)}
            label="Use message in dispatcher"
          >
            <Send />
          </IconButton>
          <IconButton
            tone="neutral"
            variant="ghost"
            onClick={onClose}
            label="Close message details"
          >
            <X />
          </IconButton>
        </div>
      </header>

      <ScrollArea className="dev-host-scroll">
        <div className="dev-host-details">
          <div className="dev-host-detail-section">
            <span className="dev-host-label">Date</span>
            <div className="dev-host-detail-value">{formatMessageDate(selectedMessage.date)}</div>
          </div>
          <div className="dev-host-detail-section">
            <span className="dev-host-label">Type</span>
            <div className="dev-host-detail-value">{selectedMessage.type}</div>
          </div>
          <div className="dev-host-detail-section">
            <span className="dev-host-label">Payload</span>
            <div className="dev-host-detail-payload">
              {typeof selectedMessage.payload === 'object' && selectedMessage.payload !== null ? (
                <JsonInspector data={selectedMessage.payload} defaultExpandedDepth={2} />
              ) : (
                <pre className="m-0 whitespace-pre-wrap break-words">
                  {formatPayloadForCommandInput(selectedMessage.payload)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </section>
  );
};

export const getDispatcherValuesFromMessage = (message: MessageEntry) => {
  return {
    commandType: message.type,
    commandPayload: formatPayloadForCommandInput(message.payload),
  };
};
