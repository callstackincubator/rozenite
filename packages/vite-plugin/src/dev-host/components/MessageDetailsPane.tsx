import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MessageEntry, ResizeHandleId } from '../types.js';
import { formatMessageDate, formatPayloadForCommandInput } from '../utils.js';
import { MessagePayloadDetail } from './MessagePayloadDetail.js';
import { ResizeHandle } from './ResizeHandle.js';
import { ScrollArea } from './ui/ScrollArea.js';
import { SendIcon } from './icons.js';
import { IconButton } from './ui/IconButton.js';

type MessageDetailsPaneProps = {
  selectedMessage: MessageEntry | null;
  isOpen: boolean;
  isNarrowViewport: boolean;
  activeResizeHandle: ResizeHandleId | null;
  onClose: () => void;
  onUseMessage: (message: MessageEntry) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export const MessageDetailsPane = ({
  selectedMessage,
  isOpen,
  isNarrowViewport,
  activeResizeHandle,
  onClose,
  onUseMessage,
  onResizeStart,
}: MessageDetailsPaneProps) => {
  const isHidden = !isOpen || !selectedMessage;

  return (
    <>
      <ResizeHandle
        className="rz-column-resize-handle"
        isDragging={activeResizeHandle === 'details-width'}
        isHidden={isHidden}
        orientation={isNarrowViewport ? 'horizontal' : 'vertical'}
        label="Resize message details"
        onPointerDown={onResizeStart}
      />

      <div className="rz-pane" data-hidden={isHidden} aria-hidden={isHidden}>
        <div className="rz-sidebar">
          <div className="rz-sidebar-header">
            <div className="rz-sidebar-title">Message Details</div>
            <div className="rz-header-actions">
              <IconButton
                type="button"
                aria-label="Use message in dispatcher"
                title="Use message in dispatcher"
                onClick={() => {
                  if (selectedMessage) {
                    onUseMessage(selectedMessage);
                  }
                }}
              >
                <SendIcon />
              </IconButton>

              <IconButton
                type="button"
                aria-label="Close message details"
                onClick={onClose}
              >
                ×
              </IconButton>
            </div>
          </div>

          <ScrollArea className="rz-sidebar-scroll">
            {selectedMessage ? (
              <div className="rz-message-detail">
                <div className="rz-detail-section">
                  <div className="rz-label">Date</div>
                  <div className="rz-detail-value rz-detail-mono">
                    {formatMessageDate(selectedMessage.date)}
                  </div>
                </div>

                <div className="rz-detail-section">
                  <div className="rz-label">Type</div>
                  <div className="rz-detail-value rz-detail-mono">{selectedMessage.type}</div>
                </div>

                <div className="rz-detail-section">
                  <div className="rz-label">Payload</div>
                  <div className="rz-detail-payload">
                    <MessagePayloadDetail payload={selectedMessage.payload} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rz-empty-state">Select a message to inspect its details.</div>
            )}
          </ScrollArea>
        </div>
      </div>
    </>
  );
};

export const getDispatcherValuesFromMessage = (message: MessageEntry) => {
  return {
    commandType: message.type,
    commandPayload: formatPayloadForCommandInput(message.payload),
  };
};
