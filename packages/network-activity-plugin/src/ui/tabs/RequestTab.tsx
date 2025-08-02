import { ScrollArea } from '../components/ScrollArea';
import { JsonTree } from '../components/JsonTree';

export type RequestTabProps = {
  selectedRequest: {
    method: string;
    requestBody?: {
      type: string;
      data: string;
    };
  };
};

export const RequestTab = ({ selectedRequest }: RequestTabProps) => {
  const renderRequestBody = () => {
    if (!selectedRequest?.requestBody) return null;

    const { type, data } = selectedRequest.requestBody;

    if (type === 'application/json') {
      try {
        const jsonData = JSON.parse(data);
        return (
          <div className="bg-gray-800 p-3 rounded border border-gray-700">
            <JsonTree data={jsonData} />
          </div>
        );
      } catch {
        // Fallback to pre tag if JSON parsing fails
        return (
          <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded border border-gray-700 overflow-x-auto">
            {data}
          </pre>
        );
      }
    }

    // For non-JSON content types, use the existing pre tag
    return (
      <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded border border-gray-700 overflow-x-auto">
        {data}
      </pre>
    );
  };

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-4">
        {selectedRequest?.requestBody ? (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                Request Body
              </h4>
              <div className="text-sm mb-2">
                <span className="text-gray-400">Content-Type: </span>
                <span className="text-blue-400">
                  {selectedRequest.requestBody.type}
                </span>
              </div>
            </div>
            <div>{renderRequestBody()}</div>
          </div>
        ) : (
          <div className="text-sm text-gray-400">
            {selectedRequest?.method === 'GET'
              ? "GET requests don't have a request body"
              : 'No request body for this request'}
          </div>
        )}
      </div>
    </ScrollArea>
  );
};
