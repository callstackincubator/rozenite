import { useMemo } from 'react';
import { ScrollArea } from '../components/ScrollArea';
import { HttpNetworkEntry } from '../state/model';
import { getStatusColor } from '../utils/getStatusColor';

export type HeadersTabProps = {
  selectedRequest: HttpNetworkEntry;
};

export const HeadersTab = ({ selectedRequest }: HeadersTabProps) => {
  const url = useMemo(() => {
    return new URL(selectedRequest.request.url);
  }, [selectedRequest.request.url]);

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-4 space-y-4">
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">General</h4>
          <div className="space-y-1 text-sm">
            <div className="flex">
              <span className="w-32 text-gray-400">Request URL:</span>
              <span className="text-blue-400">
                {url.hostname}
                {url.pathname}
              </span>
            </div>
            <div className="flex">
              <span className="w-32 text-gray-400">Request Method:</span>
              <span>{selectedRequest.request.method}</span>
            </div>
            <div className="flex">
              <span className="w-32 text-gray-400">Status Code:</span>
              <span
                className={getStatusColor(
                  selectedRequest.response?.status ?? 0
                )}
              >
                {selectedRequest.response?.status ?? 'Pending'}
              </span>
            </div>
            {selectedRequest.request.body && (
              <div className="flex">
                <span className="w-32 text-gray-400">Content-Type:</span>
                <span className="text-blue-400">
                  {selectedRequest.request.body.type}
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
              const responseHeaders = selectedRequest.response?.headers;
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
              const requestHeaders = selectedRequest.request.headers;
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
