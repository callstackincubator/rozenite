import { useCallback } from 'react';
import { Copy, Check, ChevronDown } from 'lucide-react';
import { Button, Menu } from '@rozenite/ui';
import { generateFetchCall } from '../utils/generateFetchCall';
import { generateCurlCommand } from '../utils/generateCurlCommand';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { HttpNetworkEntry, SSENetworkEntry } from '../state/model';
import { checkRequestBodyBinary } from '../utils/checkRequestBodyBinary';

type NetworkEntry = HttpNetworkEntry | SSENetworkEntry;

type CopyDropdownProps = {
  selectedRequest: NetworkEntry;
};

type CopyOption = {
  id: string;
  label: string;
  generate: (request: NetworkEntry) => string;
  isEnabled: (request: NetworkEntry) => boolean;
};

const copyOptions: CopyOption[] = [
  {
    id: 'fetch',
    label: 'fetch',
    generate: generateFetchCall,
    isEnabled: (request) => !checkRequestBodyBinary(request),
  },
  {
    id: 'curl',
    label: 'cURL',
    generate: generateCurlCommand,
    isEnabled: (request) => !checkRequestBodyBinary(request) || request.type === 'sse',
  },
];

export const CopyRequestDropdown = ({ selectedRequest }: CopyDropdownProps) => {
  const { isCopied, copy } = useCopyToClipboard();

  const handleCopy = useCallback(
    async (option: CopyOption) => {
      if (!selectedRequest) return;

      try {
        const content = await option.generate(selectedRequest);

        await copy(content);
      } catch (error) {
        console.error(`Failed to copy ${option.label}:`, error);
      }
    },
    [selectedRequest, copy],
  );

  const filteredCopyOptions = copyOptions.filter((option) => option.isEnabled(selectedRequest));

  if (filteredCopyOptions.length === 0) {
    return null;
  }

  return (
    <Menu>
      <Menu.Trigger
        render={<Button tone="neutral" variant="outline" size="sm" className="self-start" />}
      >
        {isCopied ? <Check /> : <Copy />}
        Copy as ...
        <ChevronDown className="ml-0.5 !size-3" />
      </Menu.Trigger>
      <Menu.Content align="start">
        {filteredCopyOptions.map((option) => (
          <Menu.Item onClick={() => handleCopy(option)} key={option.id}>
            {option.label}
          </Menu.Item>
        ))}
      </Menu.Content>
    </Menu>
  );
};
