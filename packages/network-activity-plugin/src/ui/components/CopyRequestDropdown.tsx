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

type CopyDropdownProps = {
  selectedRequest: HttpNetworkEntry | SSENetworkEntry;
};

type CopyOption = {
  id: string;
  label: string;
  generate: (request: HttpNetworkEntry | SSENetworkEntry) => string;
};

const copyOptions: CopyOption[] = [
  {
    id: 'fetch',
    label: 'fetch',
    generate: generateFetchCall,
  },
  {
    id: 'curl',
    label: 'cURL',
    generate: generateCurlCommand,
  },
];

export const CopyRequestDropdown = ({ selectedRequest }: CopyDropdownProps) => {
  const { isCopied, copy } = useCopyToClipboard();

  const isCopyEnabled = selectedRequest.request.body?.data.type !== 'binary';

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

  if (!isCopyEnabled) {
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
        {copyOptions.map((option) => {
          return (
            <div key={option.id}>
              <DropdownMenuItem
                onClick={() => handleCopy(option)}
                className="cursor-pointer"
              >
                {option.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
