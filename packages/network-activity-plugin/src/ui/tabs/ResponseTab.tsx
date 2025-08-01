import { useEffect, useRef } from 'react';
import { ScrollArea } from '../components/ScrollArea';
import { JsonTree } from '../components/JsonTree';

export type ResponseTabProps = {
  selectedRequest: {
    id: string;
    type: string;
    responseBody?: {
      type: string;
      data: string | null;
    };
  };
  onRequestResponseBody: (requestId: string) => void;
};

export const ResponseTab = ({
  selectedRequest,
  onRequestResponseBody,
}: ResponseTabProps) => {
  const onRequestResponseBodyRef = useRef(onRequestResponseBody);

  useEffect(() => {
    onRequestResponseBodyRef.current = onRequestResponseBody;
  }, [onRequestResponseBody]);

  useEffect(() => {
    if (onRequestResponseBodyRef.current) {
      onRequestResponseBodyRef.current(selectedRequest.id);
    }
  }, [selectedRequest.id]);

  const renderResponseBody = () => {
    if (!selectedRequest?.responseBody) {
      return (
        <div className="text-sm text-gray-400">
          No response body available for this request
        </div>
      );
    }

    const { type, data } = selectedRequest.responseBody;

    // Handle null data
    if (data === null) {
      return (
        <div className="text-sm text-gray-400">
          No response body available for this request
        </div>
      );
    }

    // Handle JSON content
    if (type === 'application/json') {
      try {
        const jsonData = JSON.parse(data);
        return (
          <div className="space-y-4">
            <div className="text-sm mb-2">
              <span className="text-gray-400">Content-Type: </span>
              <span className="text-blue-400">{type}</span>
            </div>
            <div className="bg-gray-800 p-3 rounded border border-gray-700">
              <JsonTree data={jsonData} />
            </div>
          </div>
        );
      } catch {
        // Fallback to pre tag if JSON parsing fails
        return (
          <div className="space-y-4">
            <div className="text-sm mb-2">
              <span className="text-gray-400">Content-Type: </span>
              <span className="text-blue-400">{type}</span>
            </div>
            <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded border border-gray-700 overflow-x-auto">
              {data}
            </pre>
            <div className="text-xs text-gray-500">
              ⚠️ Failed to parse as JSON, showing as raw text
            </div>
          </div>
        );
      }
    }

    // Handle HTML content
    if (type === 'text/html') {
      return (
        <div className="space-y-4">
          <div className="text-sm mb-2">
            <span className="text-gray-400">Content-Type: </span>
            <span className="text-blue-400">{type}</span>
          </div>
          <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded border border-gray-700 overflow-x-auto">
            {data}
          </pre>
        </div>
      );
    }

    // Handle other text content types
    if (
      type.startsWith('text/') ||
      type === 'application/xml' ||
      type === 'application/javascript'
    ) {
      return (
        <div className="space-y-4">
          <div className="text-sm mb-2">
            <span className="text-gray-400">Content-Type: </span>
            <span className="text-blue-400">{type}</span>
          </div>
          <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded border border-gray-700 overflow-x-auto">
            {data}
          </pre>
        </div>
      );
    }

    // Handle other content types
    return (
      <div className="space-y-4">
        <div className="text-sm mb-2">
          <span className="text-gray-400">Content-Type: </span>
          <span className="text-blue-400">{type}</span>
        </div>
        <div className="text-sm text-gray-400">
          Binary content not shown - {data.length} bytes
        </div>
      </div>
    );
  };

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-4">
        {renderResponseBody()}
      </div>
    </ScrollArea>
  );
};
