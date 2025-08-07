import { Badge } from './Badge';
import { Button } from './Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';
import { HeadersTab } from '../tabs/HeadersTab';
import { RequestTab } from '../tabs/RequestTab';
import { ResponseTab } from '../tabs/ResponseTab';
import { CookiesTab } from '../tabs/CookiesTab';
import { TimingTab } from '../tabs/TimingTab';
import { X } from 'lucide-react';
import {
  useNetworkActivityActions,
  useNetworkActivityStore,
  useSelectedRequest,
} from '../state/hooks';
import { NetworkEntry as OldNetworkEntry } from '../types';
import { getStatusColor } from '../utils/getStatusColor';
import { MessagesTab } from '../tabs/MessagesTab';
import { SSEMessagesTab } from '../tabs/SSEMessagesTab';

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    document: 'bg-blue-600',
    script: 'bg-yellow-600',
    stylesheet: 'bg-purple-600',
    xhr: 'bg-green-600',
    img: 'bg-pink-600',
    font: 'bg-orange-600',
    http: 'bg-green-600',
    websocket: 'bg-blue-600',
    sse: 'bg-purple-600',
  };
  return colors[type] || 'bg-gray-600';
};

// Adapter to convert new model to old format for tab components
const createLegacyNetworkEntry = (
  selectedRequest: any,
  httpDetails: any,
  wsDetails: any
): OldNetworkEntry | null => {
  if (selectedRequest.type === 'http' && httpDetails) {
    return {
      requestId: httpDetails.id,
      url: httpDetails.request?.url || '',
      method: httpDetails.request?.method || 'GET',
      headers: httpDetails.request?.headers || {},
      body: httpDetails.request?.body,
      status: httpDetails.status,
      startTime: httpDetails.timestamp,
      endTime: httpDetails.duration
        ? httpDetails.timestamp + httpDetails.duration
        : undefined,
      duration: httpDetails.duration,
      ttfb: httpDetails.ttfb,
      type: httpDetails.resourceType,
      initiator: httpDetails.initiator,
      request: httpDetails.request,
      response: httpDetails.response,
      responseBody: httpDetails.response?.body
        ? { body: httpDetails.response.body }
        : undefined,
      error: httpDetails.error,
      canceled: httpDetails.canceled,
      size: httpDetails.size,
    };
  } else if (selectedRequest.type === 'websocket' && wsDetails) {
    // For WebSocket, create a minimal entry since tabs are designed for HTTP
    return {
      requestId: wsDetails.id,
      url: wsDetails.connection?.url || '',
      method: 'WS',
      headers: {},
      status: wsDetails.status === 'open' ? 'finished' : 'pending',
      startTime: wsDetails.timestamp,
      endTime: wsDetails.duration
        ? wsDetails.timestamp + wsDetails.duration
        : undefined,
      duration: wsDetails.duration,
    };
  }
  return null;
};

export const SidePanel = () => {
  const actions = useNetworkActivityActions();
  const selectedRequest = useSelectedRequest();
  const client = useNetworkActivityStore((state) => state._client);

  const onClose = (): void => {
    actions.setSelectedRequest(null);
  };

  // Early return if no request is selected
  if (!selectedRequest) {
    return null;
  }

  // Get detailed information based on request type
  const httpDetails = selectedRequest.type === 'http' ? selectedRequest : null;
  const wsDetails =
    selectedRequest.type === 'websocket' ? selectedRequest : null;
  const sseDetails = selectedRequest.type === 'sse' ? selectedRequest : null;

  // Extract name from the request
  const requestName =
    selectedRequest.type === 'http'
      ? httpDetails?.request?.url || 'Unknown'
      : selectedRequest.type === 'websocket'
      ? wsDetails?.connection?.url || 'Unknown'
      : sseDetails?.request?.url || 'Unknown';

  // Extract status from the request
  const requestStatus =
    selectedRequest.type === 'http'
      ? httpDetails?.response?.status || httpDetails?.status || 'pending'
      : selectedRequest.type === 'websocket'
      ? wsDetails?.status || 'unknown'
      : sseDetails?.status || 'unknown';

  // Create legacy network entry for tab components
  const legacyEntry = createLegacyNetworkEntry(
    selectedRequest,
    httpDetails,
    wsDetails
  );
  const legacyNetworkEntries = new Map<string, OldNetworkEntry>();
  if (legacyEntry) {
    legacyNetworkEntries.set(legacyEntry.requestId, legacyEntry);
  }

  const getTabsListTriggers = () => {
    if (httpDetails) {
      return (
        <>
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
        </>
      );
    }

    if (sseDetails) {
      return (
        <>
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
            value="messages"
            className="data-[state=active]:bg-gray-700"
          >
            Messages
          </TabsTrigger>
        </>
      );
    }

    return (
      <>
        <TabsTrigger
          value="messages"
          className="data-[state=active]:bg-gray-700"
        >
          Messages
        </TabsTrigger>
      </>
    );
  };

  const getTabsContent = () => {
    if (httpDetails) {
      return (
        <>
          <TabsContent value="headers" className="flex-1 m-0 overflow-hidden">
            <HeadersTab selectedRequest={httpDetails} />
          </TabsContent>

          <TabsContent value="request" className="flex-1 m-0 overflow-hidden">
            <RequestTab selectedRequest={httpDetails} />
          </TabsContent>

          <TabsContent value="response" className="flex-1 m-0 overflow-hidden">
            <ResponseTab
              selectedRequest={httpDetails}
              onRequestResponseBody={(requestId) => {
                if (client) {
                  client.send('get-response-body', {
                    requestId,
                  });
                }
              }}
            />
          </TabsContent>

          <TabsContent value="cookies" className="flex-1 m-0 overflow-hidden">
            <CookiesTab selectedRequest={httpDetails} />
          </TabsContent>

          <TabsContent value="timing" className="flex-1 m-0 overflow-hidden">
            <TimingTab selectedRequest={httpDetails} />
          </TabsContent>
        </>
      );
    }

    if (wsDetails) {
      return (
        <>
          <TabsContent value="messages" className="flex-1 m-0 overflow-hidden">
            <MessagesTab selectedRequest={wsDetails} />
          </TabsContent>
        </>
      );
    }

    if (sseDetails) {
      return (
        <>
          <TabsContent value="headers" className="flex-1 m-0 overflow-hidden">
            <HeadersTab selectedRequest={sseDetails} />
          </TabsContent>

          <TabsContent value="request" className="flex-1 m-0 overflow-hidden">
            <RequestTab selectedRequest={sseDetails} />
          </TabsContent>

          <TabsContent value="messages" className="flex-1 m-0 overflow-hidden">
            <SSEMessagesTab selectedRequest={sseDetails} />
          </TabsContent>

          <TabsContent value="cookies" className="flex-1 m-0 overflow-hidden">
            <CookiesTab selectedRequest={sseDetails} />
          </TabsContent>
        </>
      );
    }

    throw new Error('Invalid request type');
  };

  return (
    <div className="w-1/2 flex flex-col bg-gray-900">
      {/* Side Panel Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${getTypeColor(
              selectedRequest.type
            )}`}
          ></div>
          <span className="font-medium">{requestName}</span>
          <Badge
            variant="outline"
            className={`${getStatusColor(requestStatus)} border-current`}
          >
            {requestStatus}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 text-gray-400 hover:text-blue-400"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Side Panel Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs
          key={selectedRequest.id}
          defaultValue={
            selectedRequest.type === 'websocket' ? 'messages' : 'headers'
          }
          className="h-full flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-5 bg-gray-800 rounded-none border-b border-gray-700">
            {getTabsListTriggers()}
          </TabsList>

          {getTabsContent()}
        </Tabs>
      </div>
    </div>
  );
};
