import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type { QueryCacheNotifyEvent, MutationCacheNotifyEvent, QueryClient, Query } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

type DevToolsActionType =
  | 'REFETCH'
  | 'INVALIDATE'
  | 'RESET'
  | 'REMOVE'
  | 'TRIGGER_ERROR'
  | 'RESTORE_ERROR'
  | 'TRIGGER_LOADING'
  | 'RESTORE_LOADING'
  | 'CLEAR_MUTATION_CACHE'
  | 'CLEAR_QUERY_CACHE';

interface DevToolsEventDetail {
  type: DevToolsActionType;
  queryHash?: string;
  mutationId?: number;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

type DevToolsEventMap = {
  "DEVTOOLS_TO_DEVICE": DevToolsEventDetail;
  "DEVICE_TO_DEVTOOLS": QueryCacheNotifyEvent | MutationCacheNotifyEvent;
  "DEVICE_TO_DEVTOOLS_ACK": { requestId: string; success: boolean };
}

export const useTanstackQueryDevTools = (queryClient: QueryClient) => {
  const client = useRozeniteDevToolsClient<DevToolsEventMap>({
    pluginId: '@rozenite/tanstack-query-plugin',
  })

  // Track pending DevTools requests that are waiting for acknowledgment
  const pendingDevToolsRequests = useRef<Set<string>>(new Set());

  const handleEvent = useCallback((event: DevToolsEventDetail) => {
    const getQuery = (hash: string): Query | undefined => {
      return queryClient.getQueryCache().getAll().find(q => q.queryHash === hash);
    }
  
    const onEvent = (event: DevToolsEventDetail): void => {
      const { type, queryHash, metadata, requestId } = event;
  
      if (type === 'REFETCH' && queryHash) {
        getQuery(queryHash)?.fetch();
        if (requestId) {
          pendingDevToolsRequests.current.add(requestId);
          // Acknowledge immediately after the fetch is initiated
          client?.send("DEVICE_TO_DEVTOOLS_ACK", { requestId, success: true });
          pendingDevToolsRequests.current.delete(requestId);
        }
      }
      if (type === 'INVALIDATE' && queryHash) {
        const query = getQuery(queryHash);
        if (query) {
          queryClient.invalidateQueries({ queryKey: query.queryKey });
        }
        if (requestId) {
          client?.send("DEVICE_TO_DEVTOOLS_ACK", { requestId, success: true });
        }
      }
      if (type === 'RESET' && queryHash) {
        const query = getQuery(queryHash);
        if (query) {
          queryClient.resetQueries({ queryKey: query.queryKey });
        }
        if (requestId) {
          client?.send("DEVICE_TO_DEVTOOLS_ACK", { requestId, success: true });
        }
      }
      if (type === 'REMOVE' && queryHash) {
        const query = getQuery(queryHash);
        if (query) {
          queryClient.removeQueries({ queryKey: query.queryKey });
        }
        if (requestId) {
          client?.send("DEVICE_TO_DEVTOOLS_ACK", { requestId, success: true });
        }
      }
      if (type === 'TRIGGER_LOADING' && queryHash) {
        const query = getQuery(queryHash);
        
        if (query) {
          // Set state to loading/pending (simulate fetch in progress)
          query.setState({
            ...query.state,
            fetchStatus: 'fetching',
            status: 'pending',
            error: null,
          });
          
          if (requestId) {
            pendingDevToolsRequests.current.add(requestId);
            // Acknowledge immediately after the state change is applied
            client?.send("DEVICE_TO_DEVTOOLS_ACK", { requestId, success: true });
            pendingDevToolsRequests.current.delete(requestId);
          }
        }
      }
      if (type === 'RESTORE_LOADING' && queryHash) {
        console.log('RESTORE_LOADING', event);
        const query = getQuery(queryHash);
        if (query) {
          // Set state to idle/success (simulate fetch complete)
          query.setState({
            ...query.state,
            fetchStatus: 'idle',
          });
          
          if (requestId) {
            pendingDevToolsRequests.current.add(requestId);
            // Acknowledge immediately after the state change is applied
            client?.send("DEVICE_TO_DEVTOOLS_ACK", { requestId, success: true });
            pendingDevToolsRequests.current.delete(requestId);
          }
        }
      }
      if (type === 'TRIGGER_ERROR' && queryHash) {
        const query = getQuery(queryHash);
        if (query) {
          query.setState({
            ...query.state,
            fetchStatus: 'idle',
            status: 'error',
            error: metadata?.error as Error || new Error('Forced error via devtools'),
            errorUpdateCount: (query.state.errorUpdateCount ?? 0) + 1,
            errorUpdatedAt: Date.now(),
          });
          
          if (requestId) {
            pendingDevToolsRequests.current.add(requestId);
            // Acknowledge immediately after the state change is applied
            client?.send("DEVICE_TO_DEVTOOLS_ACK", { requestId, success: true });
            pendingDevToolsRequests.current.delete(requestId);
          }
        }
      }
      if (type === 'RESTORE_ERROR' && queryHash) {
        const query = getQuery(queryHash);
        if (query) {
          queryClient.resetQueries({ queryKey: query.queryKey });
        }
        if (requestId) {
          client?.send("DEVICE_TO_DEVTOOLS_ACK", { requestId, success: true });
        }
      }
      if (type === 'CLEAR_MUTATION_CACHE') {
        queryClient.getMutationCache().clear();
        if (requestId) {
          client?.send("DEVICE_TO_DEVTOOLS_ACK", { requestId, success: true });
        }
      }
      if (type === 'CLEAR_QUERY_CACHE') {
        queryClient.clear();
        if (requestId) {
          client?.send("DEVICE_TO_DEVTOOLS_ACK", { requestId, success: true });
        }
      }
    }

    onEvent(event);
  }, [queryClient, client]);

  useEffect(() => {
    if (!client) return;

    const subscription = client.onMessage("DEVTOOLS_TO_DEVICE", handleEvent);
    return () => subscription.remove();
  }, [handleEvent, client]);

  useEffect(() => {
    if (!client) return;

    return queryClient.getQueryCache().subscribe((event) => {
      // Don't send events for queries that have pending DevTools requests
      if (pendingDevToolsRequests.current.size > 0) {
        return;
      }
      
      client.send("DEVICE_TO_DEVTOOLS", event);
    });
  }, [client, queryClient]);

  // Subscribe to mutation cache events
  useEffect(() => {
    if (!client) return;

    return queryClient.getMutationCache().subscribe((event) => {
      // Don't send events for mutations that have pending DevTools requests
      if (pendingDevToolsRequests.current.size > 0) {
        return;
      }
      
      client.send("DEVICE_TO_DEVTOOLS", event);
    });
  }, [client, queryClient]);
}