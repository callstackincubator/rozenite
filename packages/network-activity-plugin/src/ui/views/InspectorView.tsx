import { useState, useMemo, useEffect } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';
import { HeadersTab } from '../tabs/HeadersTab';
import { RequestTab } from '../tabs/RequestTab';
import { ResponseTab } from '../tabs/ResponseTab';
import { CookiesTab } from '../tabs/CookiesTab';
import { TimingTab } from '../tabs/TimingTab';
import {
  RequestList,
  processNetworkEntries,
  getTypeColor,
  getStatusColor,
} from '../components/RequestList';
import { Circle, Square, Trash2, X } from 'lucide-react';
import {
  NetworkActivityDevToolsClient,
  NetworkActivityEventMap,
  RequestId,
} from '../../shared/client';
import { NetworkEntry } from '../types';

export type InspectorViewProps = {
  client: NetworkActivityDevToolsClient;
};

export const InspectorView = ({ client }: InspectorViewProps) => {
  const [isRecording, setIsRecording] = useState(true);
  const [selectedRequestId, setSelectedRequestId] = useState<RequestId | null>(
    null
  );
  const [networkEntries, setNetworkEntries] = useState<
    Map<RequestId, NetworkEntry>
  >(new Map());

  const selectedRequest = useMemo(() => {
    if (!selectedRequestId) return null;
    const processedRequests = processNetworkEntries(networkEntries);
    return (
      processedRequests.find((request) => request.id === selectedRequestId) ||
      null
    );
  }, [selectedRequestId, networkEntries]);

  useEffect(() => {
    const handleRequestSent = (
      data: NetworkActivityEventMap['request-sent']
    ) => {
      const entry: NetworkEntry = {
        requestId: data.requestId,
        url: data.request.url,
        method: data.request.method,
        headers: data.request.headers,
        postData: data.request.postData,
        status: 'pending',
        startTime: data.timestamp,
        type: data.type,
        initiator: data.initiator,
        request: data.request,
      };

      setNetworkEntries((prev) => new Map(prev).set(data.requestId, entry));
    };

    const handleResponseReceived = (
      data: NetworkActivityEventMap['response-received']
    ) => {
      setNetworkEntries((prev) => {
        const entry = prev.get(data.requestId);
        if (!entry) return prev;

        const updatedEntry: NetworkEntry = {
          ...entry,
          status: 'loading',
          response: data.response,
        };

        return new Map(prev).set(data.requestId, updatedEntry);
      });
    };

    const handleRequestCompleted = (
      data: NetworkActivityEventMap['request-completed']
    ) => {
      setNetworkEntries((prev) => {
        const entry = prev.get(data.requestId);
        if (!entry) return prev;

        const updatedEntry: NetworkEntry = {
          ...entry,
          status: 'finished',
          endTime: data.timestamp,
          duration: data.duration,
          ttfb: data.ttfb,
          size: data.size,
        };

        return new Map(prev).set(data.requestId, updatedEntry);
      });
    };

    const handleRequestFailed = (
      data: NetworkActivityEventMap['request-failed']
    ) => {
      setNetworkEntries((prev) => {
        const entry = prev.get(data.requestId);
        if (!entry) return prev;

        const updatedEntry: NetworkEntry = {
          ...entry,
          status: 'failed',
          error: data.error,
          canceled: data.canceled,
        };

        return new Map(prev).set(data.requestId, updatedEntry);
      });
    };

    // Subscribe to network events
    const unsubscribeRequestSent = client.onMessage(
      'request-sent',
      handleRequestSent
    );
    const unsubscribeResponseReceived = client.onMessage(
      'response-received',
      handleResponseReceived
    );
    const unsubscribeRequestCompleted = client.onMessage(
      'request-completed',
      handleRequestCompleted
    );
    const unsubscribeRequestFailed = client.onMessage(
      'request-failed',
      handleRequestFailed
    );

    const handleResponseBody = (
      data: NetworkActivityEventMap['response-body']
    ) => {
      setNetworkEntries((prev) => {
        const entry = prev.get(data.requestId);
        if (!entry) return prev;

        const updatedEntry: NetworkEntry = {
          ...entry,
          responseBody: {
            ...entry.responseBody,
            body: data.body,
          },
        };

        console.log(updatedEntry);
        return new Map(prev).set(data.requestId, updatedEntry);
      });
    };

    const unsubscribeResponseBody = client.onMessage(
      'response-body',
      handleResponseBody
    );

    return () => {
      unsubscribeRequestSent.remove();
      unsubscribeResponseReceived.remove();
      unsubscribeRequestCompleted.remove();
      unsubscribeRequestFailed.remove();
      unsubscribeResponseBody.remove();
    };
  }, [client]);

  useEffect(() => {
    if (isRecording) {
      client.send('network-enable', {});

      return () => {
        client.send('network-disable', {});
      };
    }
  }, [isRecording, client]);

  const clearRequests = () => {
    setNetworkEntries(new Map());
    setSelectedRequestId(null);
  };

  const closeSidePanel = () => {
    setSelectedRequestId(null);
  };

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsRecording(!isRecording)}
          className={`h-8 w-8 p-0 ${
            isRecording
              ? 'text-red-400 hover:text-red-300'
              : 'text-gray-400 hover:text-blue-400'
          }`}
        >
          {isRecording ? (
            <Circle className="h-4 w-4 fill-current" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearRequests}
          className="h-8 w-8 p-0 text-gray-400 hover:text-blue-400"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Request List */}
        <div
          className={`flex flex-col ${
            selectedRequest ? 'w-1/2' : 'w-full'
          } border-r border-gray-700 overflow-hidden`}
        >
          <RequestList
            networkEntries={networkEntries}
            selectedRequestId={selectedRequestId}
            onRequestSelect={setSelectedRequestId}
          />
        </div>

        {/* Side Panel */}
        {selectedRequest && (
          <div className="w-1/2 flex flex-col bg-gray-900">
            {/* Side Panel Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${getTypeColor(
                    selectedRequest.type
                  )}`}
                ></div>
                <span className="font-medium">{selectedRequest.name}</span>
                <Badge
                  variant="outline"
                  className={`${getStatusColor(
                    selectedRequest.status
                  )} border-current`}
                >
                  {selectedRequest.status}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeSidePanel}
                className="h-6 w-6 p-0 text-gray-400 hover:text-blue-400"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Side Panel Content */}
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="headers" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-5 bg-gray-800 rounded-none border-b border-gray-700">
                  <TabsTrigger
                    value="headers"
                    className="data-[state=active]:bg-gray-700"
                  >
                    Headers
                  </TabsTrigger>
                  <TabsTrigger
                    value="request"
                    className="data-[state=active]:bg-gray-700"
                  >
                    Request
                  </TabsTrigger>
                  <TabsTrigger
                    value="response"
                    className="data-[state=active]:bg-gray-700"
                  >
                    Response
                  </TabsTrigger>
                  <TabsTrigger
                    value="cookies"
                    className="data-[state=active]:bg-gray-700"
                  >
                    Cookies
                  </TabsTrigger>
                  <TabsTrigger
                    value="timing"
                    className="data-[state=active]:bg-gray-700"
                  >
                    Timing
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="headers"
                  className="flex-1 m-0 overflow-hidden"
                >
                  <HeadersTab
                    selectedRequest={selectedRequest}
                    networkEntries={networkEntries}
                    getStatusColor={getStatusColor}
                  />
                </TabsContent>

                <TabsContent value="request" className="flex-1 m-0">
                  <RequestTab selectedRequest={selectedRequest} />
                </TabsContent>

                <TabsContent value="response" className="flex-1 m-0">
                  <ResponseTab
                    selectedRequest={selectedRequest}
                    onRequestResponseBody={(requestId) => {
                      client.send('get-response-body', {
                        requestId,
                      });
                    }}
                  />
                </TabsContent>

                <TabsContent value="cookies" className="flex-1 m-0">
                  <CookiesTab
                    selectedRequest={selectedRequest}
                    networkEntries={networkEntries}
                  />
                </TabsContent>

                <TabsContent value="timing" className="flex-1 m-0">
                  <TimingTab
                    selectedRequest={selectedRequest}
                    networkEntries={networkEntries}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
