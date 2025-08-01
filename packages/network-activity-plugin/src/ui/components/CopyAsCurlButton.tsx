import { useEffect, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './Button';
import { generateCurlCommand } from '../utils/generateCurlCommand';
import { copyToClipboard } from '../utils/copyToClipboard';
import { NetworkRequest } from './RequestList';

export type CopyAsCurlButtonProps = {
  selectedRequest?: NetworkRequest;
};

export const CopyAsCurlButton = ({ selectedRequest }: CopyAsCurlButtonProps) => {
  const [copied, setCopied] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  const handleCopyCurl = async () => {
    if (!selectedRequest) return;

    try {
      const curlCommand = generateCurlCommand({
        method: selectedRequest.method,
        url: `${selectedRequest.domain}${selectedRequest.path}`,
        headers: selectedRequest.headers,
        postData: selectedRequest.requestBody?.data,
      });

      await copyToClipboard(curlCommand);
      
      setCopied(true);

      clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => setCopied(false), 1000);
    } catch (error) {
      console.error('Failed to copy cURL command:', error);
    }
  };

  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={handleCopyCurl}
      disabled={!selectedRequest}
      className="border border-gray-700"
    >
      {copied ? <Check className="w-2 h-2" /> : <Copy className="w-2 h-2" />}
      Copy as cURL
    </Button>
  );
};
