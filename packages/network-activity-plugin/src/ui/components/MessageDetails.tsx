import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { DescriptionList, IconButton, Text } from '@rozenite/ui';
import { CodeBlock } from './CodeBlock';
import { JsonTree } from './JsonTree';

export const formatMessageTimestamp = (timestamp: number) => {
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

/** A message body: pretty JSON when it parses as JSON, otherwise the text as-is. */
export const MessageContent = ({ data }: { data: string }) => {
  try {
    const jsonData = JSON.parse(data);
    return (
      <CodeBlock>
        <JsonTree data={jsonData} />
      </CodeBlock>
    );
  } catch {
    // Fall back to the plain text if it is not JSON
    return <CodeBlock>{data}</CodeBlock>;
  }
};

export type MessageDetailsProps = {
  onClose: () => void;
  /** The label/value rows describing the message. */
  children: ReactNode;
  content: ReactNode;
};

/** The pane under a message table that shows the selected message. */
export const MessageDetails = ({ onClose, children, content }: MessageDetailsProps) => (
  <div className="max-h-[55%] shrink-0 overflow-y-auto border-t border-border bg-surface">
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <Text variant="label">Message Details</Text>
        <IconButton
          label="Close message details"
          tone="neutral"
          variant="ghost"
          size="sm"
          onClick={onClose}
        >
          <X />
        </IconButton>
      </div>
      <DescriptionList>{children}</DescriptionList>
      <div className="flex flex-col gap-2">
        <Text variant="label">Content</Text>
        {content}
      </div>
    </div>
  </div>
);
