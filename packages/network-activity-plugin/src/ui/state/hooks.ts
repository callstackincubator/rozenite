import { useStore } from 'zustand';
import { store } from './store';
import type { NetworkActivityState } from './store';
import { getProcessedRequests, getSelectedRequest } from './derived';

export const useNetworkActivityStore = <T>(
  selector: (state: NetworkActivityState) => T
): T => {
  return useStore(store, selector);
};

export const useProcessedRequests = () => {
  return useNetworkActivityStore(getProcessedRequests);
};

export const useSelectedRequest = () => {
  return useNetworkActivityStore(getSelectedRequest);
};

export const useHasSelectedRequest = () => {
  return useNetworkActivityStore((state) => !!getSelectedRequest(state));
};

export const useSelectedRequestId = () => {
  return useNetworkActivityStore((state) => state.selectedRequestId);
};

export const useIsRecording = () => {
  return useNetworkActivityStore((state) => state.isRecording);
};

export const useNetworkActivityActions = () => {
  return useNetworkActivityStore((state) => state.actions);
};

export const useNetworkActivityClientManagement = () => {
  return useNetworkActivityStore((state) => state.client);
};

export const useWebSocketMessages = (requestId: string) => {
  return useNetworkActivityStore(
    (state) => state.websocketMessages.get(requestId) || []
  );
};
