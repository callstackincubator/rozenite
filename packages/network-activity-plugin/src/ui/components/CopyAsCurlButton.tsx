import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { Copy, Check } from 'lucide-react';
import { Button } from './Button';
import { generateCurlCommand } from '../utils/generateCurlCommand';
import { NetworkRequest } from './RequestList';

export type CopyAsCurlButtonProps = {
  selectedRequest?: NetworkRequest;
};

export const CopyAsCurlButton = ({ selectedRequest }: CopyAsCurlButtonProps) => {
  const { isCopied, copy } = useCopyToClipboard();

  const handleCopyCurl = () => {
    if (!selectedRequest) return;
    
    const curlCommand = generateCurlCommand({
      method: selectedRequest.method,
      url: `${selectedRequest.domain}${selectedRequest.path}`,
      headers: selectedRequest.headers,
      postData: selectedRequest.requestBody?.data,
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
