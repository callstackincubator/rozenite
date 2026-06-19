import { useCallback } from 'react';
import { useNetworkActivityStore } from '../state/hooks';
import { store } from '../state/store';
import { downloadJson } from '../utils/download';
import {
  createNetworkActivitySessionExport,
  getNetworkActivitySessionExportFileName,
} from '../utils/sessionExport';

export const useNetworkActivitySessionExport = () => {
  const canExportSession = useNetworkActivityStore(
    (state) => state.networkEntries.size > 0,
  );

  const exportSession = useCallback(() => {
    const { networkEntries, websocketMessages } = store.getState();

    if (networkEntries.size === 0) {
      return;
    }

    const exportedAt = new Date();
    const exportData = createNetworkActivitySessionExport(
      networkEntries,
      websocketMessages,
      exportedAt,
    );

    downloadJson(
      exportData,
      getNetworkActivitySessionExportFileName(exportedAt),
    );
  }, []);

  return {
    canExportSession,
    exportSession,
  };
};
