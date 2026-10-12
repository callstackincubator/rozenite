import { useEffect, useMemo, useRef, useState } from 'react';
import { PluginShell, Split } from '@rozenite/ui';
import { RequestToolbar } from '../components/RequestToolbar';
import { RequestList } from '../components/RequestList';
import { SidePanel } from '../components/SidePanel';
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
import { requestOverlapsTimelineRange, type TimelineRangeSelection } from '../utils/timelineModel';

const LIST_PANE_ID = 'requests';
const DETAILS_PANE_ID = 'details';
const DEFAULT_DETAILS_SIZE = 50;

export type InspectorViewProps = {
  client: NetworkActivityDevToolsClient;
};

export const InspectorView = ({ client }: InspectorViewProps) => {
  const actions = useNetworkActivityActions();
  const clientManagement = useNetworkActivityClientManagement();
  const hasSelectedRequest = useHasSelectedRequest();
  const overrides = useOverrides();
  const processedRequests = useProcessedRequests();
  const [filter, setFilter] = useState<FilterState>(() => createDefaultFilter());
  const [timelineSelection, setTimelineSelection] = useState<TimelineRangeSelection | null>(null);

  const filteredRequests = useMemo(() => {
    return processedRequests.filter((request) =>
      matchesRequestFilter(request, filter, {
        hasOverride: overrides.has(request.name),
      }),
    );
  }, [processedRequests, filter, overrides]);

  const visibleRequests = useMemo(() => {
    if (!timelineSelection) {
      return filteredRequests;
    }

    const now = Date.now();
    return filteredRequests.filter((request) =>
      requestOverlapsTimelineRange(request, timelineSelection, now),
    );
  }, [filteredRequests, timelineSelection]);

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

  const hasActiveFilter = filteredRequests.length !== processedRequests.length;

  const emptyState =
    processedRequests.length === 0
      ? undefined
      : {
          title: 'No matching requests',
          description: timelineSelection
            ? 'No requests in the selected time range. Clear the selection to see them again.'
            : hasActiveFilter
              ? 'No requests match the filters. Clear the filters to see every request.'
              : undefined,
        };

  // The details pane mounts and unmounts with the selection, so its size is remembered here and
  // used as the default the next time it opens.
  const detailsSize = useRef(DEFAULT_DETAILS_SIZE);
  const handleLayoutChanged = (layout: Record<string, number>) => {
    if (layout[DETAILS_PANE_ID] !== undefined) {
      detailsSize.current = layout[DETAILS_PANE_ID];
    }
  };

  return (
    <PluginShell>
      <RequestToolbar
        filter={filter}
        onFilterChange={setFilter}
        visibleCount={visibleRequests.length}
        totalCount={processedRequests.length}
      />

      <PluginShell.Body className="overflow-hidden">
        {/*
          The request list always sits in the first pane of the same group, so opening and closing
          the details pane never remounts it and its sort and scroll position survive.
        */}
        <Split
          direction="horizontal"
          autoSaveId="network-activity"
          onLayoutChanged={handleLayoutChanged}
        >
          <Split.Pane id={LIST_PANE_ID} minSize={25}>
            <div className="flex h-full min-h-0 flex-col">
              <NetworkTimeline
                requests={filteredRequests}
                selection={timelineSelection}
                filteredRequestCount={visibleRequests.length}
                onSelectionChange={setTimelineSelection}
              />
              <RequestList requests={visibleRequests} emptyState={emptyState} />
            </div>
          </Split.Pane>
          {hasSelectedRequest && (
            <>
              <Split.Handle />
              <Split.Pane id={DETAILS_PANE_ID} defaultSize={detailsSize.current} minSize={25}>
                <SidePanel />
              </Split.Pane>
            </>
          )}
        </Split>
      </PluginShell.Body>
    </PluginShell>
  );
};
