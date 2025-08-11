import { useEffect, useState } from 'react';
import { Toolbar } from '../components/Toolbar';
import { RequestList } from '../components/RequestList';
import { SidePanel } from '../components/SidePanel';
import { FilterBar, FilterState } from '../components/FilterBar';
import { NetworkActivityDevToolsClient } from '../../shared/client';
import {
  useNetworkActivityClientManagement,
  useHasSelectedRequest,
  useNetworkActivityActions,
} from '../state/hooks';

export type InspectorViewProps = {
  client: NetworkActivityDevToolsClient;
};

export const InspectorView = ({ client }: InspectorViewProps) => {
  const actions = useNetworkActivityActions();
  const clientManagement = useNetworkActivityClientManagement();
  const hasSelectedRequest = useHasSelectedRequest();
  const [filter, setFilter] = useState<FilterState>({
    text: '',
    types: new Set(['http', 'websocket', 'sse']),
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    clientManagement.setupClient(client);
    actions.setRecording(true);

    return () => {
      actions.setRecording(false);
      clientManagement.cleanupClient();
    };
  }, [client, clientManagement, actions]);

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col">
      <Toolbar />
      <FilterBar filter={filter} onFilterChange={setFilter} />

      <div className="flex flex-1 overflow-hidden">
        {/* Request List */}
        <div
          className={`flex flex-col ${
            hasSelectedRequest ? 'w-1/2' : 'w-full'
          } border-r border-gray-700 overflow-hidden`}
        >
          <RequestList filter={filter} />
        </div>

        {hasSelectedRequest && <SidePanel />}
      </div>
    </div>
  );
};
