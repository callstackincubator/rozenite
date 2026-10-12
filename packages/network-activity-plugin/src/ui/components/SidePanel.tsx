import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Badge, cn, IconButton, IndicatorDot, Tabs, Text, type Tone } from '@rozenite/ui';
import { HeadersTab } from '../tabs/HeadersTab';
import { RequestTab } from '../tabs/RequestTab';
import { ResponseTab } from '../tabs/ResponseTab';
import { CookiesTab } from '../tabs/CookiesTab';
import { TimingTab } from '../tabs/TimingTab';
import { InitiatorTab } from '../tabs/InitiatorTab';
import {
  useNetworkActivityActions,
  useNetworkActivityStore,
  useOverrides,
  useSelectedRequest,
} from '../state/hooks';
import { NetworkEntry as OldNetworkEntry } from '../types';
import { getStatusTone } from '../utils/getStatusTone';
import { MessagesTab } from '../tabs/MessagesTab';
import { SSEMessagesTab } from '../tabs/SSEMessagesTab';
import type { ResponseView } from '../response-renderers';

// Tabs share the bar when there is room and keep their full label when there is not: the bar
// scrolls sideways instead of clipping the last one.
const TAB_CLASS_NAME = 'flex-auto shrink-0';

const REQUEST_TYPE_BADGES: Record<string, { label: string; tone: Tone }> = {
  http: { label: 'HTTP', tone: 'neutral' },
  websocket: { label: 'WS', tone: 'info' },
  sse: { label: 'SSE', tone: 'warning' },
};

// Adapter to convert new model to old format for tab components
const createLegacyNetworkEntry = (
  selectedRequest: any,
  httpDetails: any,
  wsDetails: any,
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
      endTime: httpDetails.duration ? httpDetails.timestamp + httpDetails.duration : undefined,
      duration: httpDetails.duration,
      ttfb: httpDetails.ttfb,
      type: httpDetails.resourceType,
      initiator: httpDetails.initiator,
      request: httpDetails.request,
      response: httpDetails.response,
      responseBody: httpDetails.response?.body ? { body: httpDetails.response.body } : undefined,
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
      endTime: wsDetails.duration ? wsDetails.timestamp + wsDetails.duration : undefined,
      duration: wsDetails.duration,
    };
  }
  return null;
};

const TabPanel = ({ value, children }: { value: string; children: ReactNode }) => (
  <Tabs.Panel value={value} className="min-h-0 flex-1 overflow-hidden">
    {children}
  </Tabs.Panel>
);

export const SidePanel = () => {
  const actions = useNetworkActivityActions();
  const selectedRequest = useSelectedRequest();
  const client = useNetworkActivityStore((state) => state._client);
  const overrides = useOverrides();
  // Sticky Preview/Raw preference. Lives here, not in ResponseTab,
  // because the `<Tabs key={selectedRequest.id}>` below intentionally
  // remounts the Tabs subtree on every request switch (so the active
  // inner tab resets). SidePanel itself stays mounted across request
  // switches, so the preference survives — flipping to Raw on one
  // response keeps Raw selected for every subsequent response whose
  // renderer supports it. Resets when the panel is closed.
  const [preferredView, setPreferredView] = useState<ResponseView>('preview');

  const onClose = (): void => {
    actions.setSelectedRequest(null);
  };

  // Early return if no request is selected
  if (!selectedRequest) {
    return null;
  }

  // Get detailed information based on request type
  const httpDetails = selectedRequest.type === 'http' ? selectedRequest : null;
  const wsDetails = selectedRequest.type === 'websocket' ? selectedRequest : null;
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
  const legacyEntry = createLegacyNetworkEntry(selectedRequest, httpDetails, wsDetails);
  const legacyNetworkEntries = new Map<string, OldNetworkEntry>();
  if (legacyEntry) {
    legacyNetworkEntries.set(legacyEntry.requestId, legacyEntry);
  }

  const override = legacyEntry !== null ? overrides.get(legacyEntry.url) : null;
  const supportsOverrides = httpDetails?.source !== 'nitro' && httpDetails?.source !== 'expo';
  const hasResponseOverride = supportsOverrides && override && override.body ? true : false;

  const typeBadge = REQUEST_TYPE_BADGES[selectedRequest.type];

  const getTabsListTriggers = () => {
    if (httpDetails) {
      return (
        <>
          <Tabs.Tab value="headers" className={TAB_CLASS_NAME}>
            Headers
          </Tabs.Tab>
          <Tabs.Tab value="request" className={TAB_CLASS_NAME}>
            Request
          </Tabs.Tab>
          <Tabs.Tab value="response" className={cn(TAB_CLASS_NAME, 'gap-1.5')}>
            Response
            {hasResponseOverride && <IndicatorDot aria-label="Overridden" />}
          </Tabs.Tab>
          <Tabs.Tab value="cookies" className={TAB_CLASS_NAME}>
            Cookies
          </Tabs.Tab>
          <Tabs.Tab value="initiator" className={TAB_CLASS_NAME}>
            Initiator
          </Tabs.Tab>
          <Tabs.Tab value="timing" className={TAB_CLASS_NAME}>
            Timing
          </Tabs.Tab>
        </>
      );
    }

    if (sseDetails) {
      return (
        <>
          <Tabs.Tab value="headers" className={TAB_CLASS_NAME}>
            Headers
          </Tabs.Tab>
          <Tabs.Tab value="request" className={TAB_CLASS_NAME}>
            Request
          </Tabs.Tab>
          <Tabs.Tab value="messages" className={TAB_CLASS_NAME}>
            Messages
          </Tabs.Tab>
          <Tabs.Tab value="initiator" className={TAB_CLASS_NAME}>
            Initiator
          </Tabs.Tab>
        </>
      );
    }

    return (
      <Tabs.Tab value="messages" className={TAB_CLASS_NAME}>
        Messages
      </Tabs.Tab>
    );
  };

  const getTabsContent = () => {
    if (httpDetails) {
      return (
        <>
          <TabPanel value="headers">
            <HeadersTab selectedRequest={httpDetails} />
          </TabPanel>

          <TabPanel value="request">
            <RequestTab selectedRequest={httpDetails} />
          </TabPanel>

          <TabPanel value="response">
            <ResponseTab
              selectedRequest={httpDetails}
              supportsOverrides={supportsOverrides}
              preferredView={preferredView}
              onPreferredViewChange={setPreferredView}
              onRequestResponseBody={(requestId) => {
                if (client) {
                  client.send('get-response-body', {
                    requestId,
                  });
                }
              }}
            />
          </TabPanel>

          <TabPanel value="cookies">
            <CookiesTab selectedRequest={httpDetails} />
          </TabPanel>

          <TabPanel value="initiator">
            <InitiatorTab selectedRequest={httpDetails} />
          </TabPanel>

          <TabPanel value="timing">
            <TimingTab selectedRequest={httpDetails} />
          </TabPanel>
        </>
      );
    }

    if (wsDetails) {
      return (
        <TabPanel value="messages">
          <MessagesTab selectedRequest={wsDetails} />
        </TabPanel>
      );
    }

    if (sseDetails) {
      return (
        <>
          <TabPanel value="headers">
            <HeadersTab selectedRequest={sseDetails} />
          </TabPanel>

          <TabPanel value="request">
            <RequestTab selectedRequest={sseDetails} />
          </TabPanel>

          <TabPanel value="messages">
            <SSEMessagesTab selectedRequest={sseDetails} />
          </TabPanel>

          <TabPanel value="initiator">
            <InitiatorTab selectedRequest={sseDetails} />
          </TabPanel>

          <TabPanel value="cookies">
            <CookiesTab selectedRequest={sseDetails} />
          </TabPanel>
        </>
      );
    }

    throw new Error('Invalid request type');
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      {/* Side Panel Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2">
        {typeBadge && (
          <Badge tone={typeBadge.tone} variant="soft" size="sm">
            {typeBadge.label}
          </Badge>
        )}
        <Text variant="code" className="min-w-0 flex-1 truncate" title={requestName}>
          {requestName}
        </Text>
        <Badge tone={getStatusTone(requestStatus)} variant="soft" size="sm">
          {requestStatus}
        </Badge>
        <IconButton
          label="Close details"
          tone="neutral"
          variant="ghost"
          size="sm"
          onClick={onClose}
        >
          <X />
        </IconButton>
      </div>

      {/* Side Panel Content */}
      <Tabs
        key={selectedRequest.id}
        defaultValue={selectedRequest.type === 'websocket' ? 'messages' : 'headers'}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs.List className="relative w-full shrink-0 overflow-x-auto border-0 border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {getTabsListTriggers()}
        </Tabs.List>

        {getTabsContent()}
      </Tabs>
    </div>
  );
};
