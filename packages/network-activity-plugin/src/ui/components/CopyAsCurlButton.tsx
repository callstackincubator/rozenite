import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { Copy, Check } from 'lucide-react';
import { Button } from './Button';
import { generateCurlCommand } from '../utils/generateCurlCommand';
import { HttpNetworkEntry } from '../state/model';

export type CopyAsCurlButtonProps = {
  selectedRequest?: HttpNetworkEntry;
};

export const CopyAsCurlButton = ({
  selectedRequest,
}: CopyAsCurlButtonProps) => {
  const { isCopied, copy } = useCopyToClipboard();

  const handleCopyCurl = () => {
    if (!selectedRequest) return;

    const { method, url, headers, body } = selectedRequest.request;

    const curlCommand = generateCurlCommand({
      method,
      url,
      headers,
      postData: body?.data,
    });

    copy(curlCommand);
  };

  const Icon = isCopied ? Check : Copy;

  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={handleCopyCurl}
      disabled={!selectedRequest}
      className="border border-gray-700"
    >
      <Icon className="w-2 h-2" />
      Copy as cURL
    </Button>
  );
};
