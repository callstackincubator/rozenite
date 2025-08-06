import * as React from 'react';
import { ScrollArea } from '../components/ScrollArea';
import { JsonTree } from '../components/JsonTree';
import { NetworkRequest } from '../components/RequestList';

export type RequestTabProps = {
  selectedRequest: NetworkRequest;
};

const requestDataContainerClasses = 'bg-gray-800 p-3 rounded border border-gray-700';
const emptyRequestBodyClasses = 'text-sm text-gray-400';

const emptyRequestBody = 'No request body for this request';

export const RequestTab = ({ selectedRequest }: RequestTabProps) => {
  const requestBody = selectedRequest?.requestBody;

  const renderRequestBody = () => {
    if (!requestBody) {
      return (
        <div className={emptyRequestBodyClasses}>
          {emptyRequestBody}
        </div>
      );
    }

    const { type, value } = requestBody.data;

    if (type === 'text') {
      try {
        const jsonData = JSON.parse(value);
        return (
          <div className={requestDataContainerClasses}>
            <JsonTree data={jsonData} />
          </div>
        );
      } catch {
        // Fallback to pre tag if JSON parsing fails
        return (
          <pre className={`text-sm font-mono text-gray-300 whitespace-pre-wrap overflow-x-auto ${requestDataContainerClasses}`}>
            {value}
          </pre>
        );
      }
    }
    
    // Show JSON tree as a temporary solution for form-data and binary types
    if (type === 'form-data' || type === 'binary') {
      return (
        <div className={requestDataContainerClasses}>
          <JsonTree data={value} />
        </div>
      );
    }

    return null;
  };

  return (
    <ScrollArea className="h-full min-h-0 p-4">
      {requestBody ? (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">
              Request Body
            </h4>
            <div className="text-sm mb-2">
              <span className="text-gray-400">Content-Type: </span>
              <span className="text-blue-400">
                {requestBody.contentType}
              </span>
            </div>
          </div>
          <div>{renderRequestBody()}</div>
        </div>
      ) : (
        <div className={emptyRequestBodyClasses}>
          {selectedRequest?.method === 'GET'
            ? "GET requests don't have a request body"
            : emptyRequestBody}
        </div>
      )}
    </ScrollArea>
  );
};
