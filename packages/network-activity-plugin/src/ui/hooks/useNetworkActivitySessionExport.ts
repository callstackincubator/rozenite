import { useCallback } from 'react';
import { useNetworkEntries, useWebSocketMessagesMap } from '../state/hooks';
import { downloadJsonFile } from '../utils/downloadFile';
import {
  createNetworkActivitySessionExport,
  getNetworkActivitySessionExportFileName,
} from '../utils/sessionExport';

export const useNetworkActivitySessionExport = () => {
  const networkEntries = useNetworkEntries();
  const websocketMessages = useWebSocketMessagesMap();
  const canExportSession = networkEntries.size > 0;

  const exportSession = useCallback(() => {
    if (!canExportSession) {
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
  }, [canExportSession, networkEntries, websocketMessages]);

  return {
    canExportSession,
    exportSession,
  };
};
