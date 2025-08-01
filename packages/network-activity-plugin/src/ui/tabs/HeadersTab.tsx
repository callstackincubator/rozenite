import { CopyAsCurlButton } from '../components/CopyAsCurlButton';
import { NetworkRequest } from '../components/RequestList';
import { ScrollArea } from '../components/ScrollArea';

export type HeadersTabProps = {
  selectedRequest: NetworkRequest;
  getStatusColor: (status: number) => string;
};

export const HeadersTab = ({
  selectedRequest,
  getStatusColor,
}: HeadersTabProps) => {
  return (
    <ScrollArea className="h-full min-h-0">
      <div className="p-4 space-y-4">
        <CopyAsCurlButton selectedRequest={selectedRequest} />
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">General</h4>
          <div className="space-y-1 text-sm">
            <div className="flex">
              <span className="w-32 text-gray-400">Request URL:</span>
              <span className="text-blue-400">
                {selectedRequest.domain}
                {selectedRequest.path}
              </span>
            </div>
            <div className="flex">
              <span className="w-32 text-gray-400">Request Method:</span>
              <span>{selectedRequest.method}</span>
            </div>
            <div className="flex">
              <span className="w-32 text-gray-400">Status Code:</span>
              <span className={getStatusColor(selectedRequest.status)}>
                {selectedRequest.status}
              </span>
            </div>
            {selectedRequest.requestBody && (
              <div className="flex">
                <span className="w-32 text-gray-400">Content-Type:</span>
                <span className="text-blue-400">
                  {selectedRequest.requestBody.type}
                </span>
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">
            Response Headers
          </h4>
          <div className="space-y-1 text-sm font-mono">
            {(() => {
              const responseHeaders = selectedRequest.headers;
              if (responseHeaders && Object.keys(responseHeaders).length > 0) {
                return Object.entries(responseHeaders).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="w-32 text-gray-400">
                      {key.toLowerCase()}:
                    </span>
                    <span className="flex-1 break-all">{value}</span>
                  </div>
                ));
              } else {
                return (
                  <div className="text-gray-500 italic">
                    No response headers available
                  </div>
                );
              }
            })()}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">
            Request Headers
          </h4>
          <div className="space-y-1 text-sm font-mono">
            {(() => {
              const requestHeaders = selectedRequest.headers;
              if (requestHeaders && Object.keys(requestHeaders).length > 0) {
                return Object.entries(requestHeaders).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="w-32 text-gray-400">
                      {key.toLowerCase()}:
                    </span>
                    <span className="flex-1 break-all">{value}</span>
                  </div>
                ));
              } else {
                return (
                  <div className="text-gray-500 italic">
                    No request headers available
                  </div>
                );
              }
            })()}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
