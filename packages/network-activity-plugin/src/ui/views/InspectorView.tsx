import { useEffect, useMemo, useState } from 'react';
import { Toolbar } from '../components/Toolbar';
import { RequestList } from '../components/RequestList';
import { SidePanel } from '../components/SidePanel';
import { FilterBar } from '../components/FilterBar';
import { NetworkTimeline } from '../components/NetworkTimeline';
import { NetworkActivityDevToolsClient } from '../../shared/client';
import {
  useNetworkActivityClientManagement,
  useHasSelectedRequest,
  useNetworkActivityActions,
  useOverrides,
  useProcessedRequests,
} from '../state/hooks';
import { createDefaultFilter } from '../state/filter';
import type { FilterState } from '../state/filter';
import { matchesRequestFilter } from '../utils/requestFilters';

export type InspectorViewProps = {
  client: NetworkActivityDevToolsClient;
};

export const InspectorView = ({ client }: InspectorViewProps) => {
  const actions = useNetworkActivityActions();
  const clientManagement = useNetworkActivityClientManagement();
  const hasSelectedRequest = useHasSelectedRequest();
  const overrides = useOverrides();
  const processedRequests = useProcessedRequests();
  const [filter, setFilter] = useState<FilterState>(() =>
    createDefaultFilter(),
  );

  const filteredRequests = useMemo(() => {
    return processedRequests.filter((request) =>
      matchesRequestFilter(request, filter, {
        hasOverride: overrides.has(request.name),
      }),
    );
  }, [processedRequests, filter, overrides]);

  useEffect(() => {
    if (!client) {
      return;
    }

    clientManagement.setupClient(client);
    actions.setRecording(true);

    client.send('set-overrides', {
      overrides: Array.from(overrides.entries()),
    });

    return () => {
      actions.setRecording(false);
      clientManagement.cleanupClient();
    };
  }, [client, clientManagement, actions, overrides]);

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col">
      <Toolbar />
      <FilterBar filter={filter} onFilterChange={setFilter} />

      <div className="flex flex-1 overflow-hidden">
        <div
          className={`flex flex-col ${
            hasSelectedRequest ? 'w-1/2' : 'w-full'
          } border-r border-gray-700 overflow-hidden`}
        >
          <NetworkTimeline requests={filteredRequests} />
          <RequestList requests={filteredRequests} />
        </div>

        {hasSelectedRequest && <SidePanel />}
      </div>
    </div>
  );
};
