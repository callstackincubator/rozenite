import { ScrollArea } from '../components/ScrollArea';
import { JsonTree } from '../components/JsonTree';
import { HttpNetworkEntry, SSENetworkEntry } from '../state/model';
import { assert } from '../utils/assert';

export type RequestTabProps = {
  selectedRequest: HttpNetworkEntry | SSENetworkEntry;
};

export const RequestTab = ({ selectedRequest }: RequestTabProps) => {
  const renderRequestBody = () => {
    assert(!!selectedRequest.request.body, 'Request body is required');
    const { type, data } = selectedRequest.request.body;

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
        {selectedRequest.request.body ? (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                Request Body
              </h4>
              <div className="text-sm mb-2">
                <span className="text-gray-400">Content-Type: </span>
                <span className="text-blue-400">
                  {selectedRequest.request.body.type}
                </span>
              </div>
            </div>
            <div>{renderRequestBody()}</div>
          </div>
        ) : (
          <div className="text-sm text-gray-400">
            {selectedRequest.request.method === 'GET'
              ? "GET requests don't have a request body"
              : 'No request body for this request'}
          </div>
        )}
      </div>
    </ScrollArea>
  );
};
