import { useCallback } from 'react';
import { Copy, Check, ChevronDown } from 'lucide-react';
import { Button } from './Button';
import { generateFetchCall } from '../utils/generateFetchCall';
import { generateCurlCommand } from '../utils/generateCurlCommand';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { HttpNetworkEntry, SSENetworkEntry } from '../state/model';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './DropdownMenu';
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
    isEnabled: (request) =>
      !checkRequestBodyBinary(request) || request.type === 'sse',
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
    [selectedRequest, copy]
  );

  const filteredCopyOptions = copyOptions.filter((option) =>
    option.isEnabled(selectedRequest)
  );

  if (filteredCopyOptions.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" className="border border-gray-700">
          {isCopied ? <Check size={16} /> : <Copy size={16} />}
          Copy as ...
          <ChevronDown size={12} className="ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {filteredCopyOptions.map((option) => {
          return (
            <DropdownMenuItem
              onClick={() => handleCopy(option)}
              className="cursor-pointer"
              key={option.id}
            >
              {option.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
