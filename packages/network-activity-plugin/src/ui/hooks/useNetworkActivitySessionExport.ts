import { useCallback } from 'react';
import { useNetworkActivityStore } from '../state/hooks';
import { store } from '../state/store';
import { downloadJsonFile } from '../utils/downloadFile';
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

    downloadJsonFile(
      getNetworkActivitySessionExportFileName(exportedAt),
      exportData,
    );
  }, []);

  return {
    canExportSession,
    exportSession,
  };
};
