import { createComponentTreeStore } from './component-tree-store.js';
import { createInspectionStore } from './inspection-store.js';
import { createProfilingStore } from './profiling-store.js';
import type { ReactTreeSyncPayload } from './types.js';

export interface ReactProfilingStatus {
  supportsProfiling: boolean;
  supportsReloadAndProfile: boolean;
  isProfilingStarted: boolean;
  isProcessingData: boolean;
  hasProfilingData: boolean;
  rootsWithData: number;
  rootsCount: number;
}

export type ReactDevToolsBridge = {
  ingest: (message: { event: string; payload: unknown }) => ReactTreeSyncPayload | null;
  send: (event: string, payload: unknown) => void;
  startProfiling: () => void;
  stopProfiling: () => void;
  reloadAndProfile: () => void;
  getProfilingStatus: () => ReactProfilingStatus;
  getProfilingDataSnapshot: () => unknown;
  getCommitData: (rootId: number, commitIndex: number) => unknown;
};

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const getRendererIdFromOperations = (payload: unknown): number | null => {
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const candidate = Number(payload[0]);
  if (!Number.isInteger(candidate) || candidate <= 0) {
    return null;
  }

  return candidate;
};

export const createReactDevToolsBridge = async (options?: {
  sendMessage?: (message: { event: string; payload: unknown }) => void;
}): Promise<ReactDevToolsBridge> => {
  const componentTreeStore = createComponentTreeStore();
  const inspectionStore = createInspectionStore();
  const profilingStore = createProfilingStore();
  const rendererIds = new Set<number>();

  const send = (event: string, payload: unknown): void => {
    options?.sendMessage?.({ event, payload });
  };

  return {
    ingest(message: { event: string; payload: unknown }): ReactTreeSyncPayload | null {
      switch (message.event) {
        case 'operations': {
          const rendererId = getRendererIdFromOperations(message.payload);
          if (rendererId !== null) {
            rendererIds.add(rendererId);
            profilingStore.registerRenderer(rendererId);
          }
          return componentTreeStore.ingestOperations(message.payload);
        }

        case 'inspectedElement':
          inspectionStore.ingestInspectedElement(message.payload);
          return null;

        case 'profilingStatus':
          profilingStore.ingestProfilingStatus(message.payload);
          return null;

        case 'profilingData':
          profilingStore.ingestProfilingData(message.payload);
          return null;

        case 'renderer':
        case 'rendererAttached': {
          const payload = getRecord(message.payload);
          const rendererId = payload?.id;
          if (Number.isInteger(rendererId)) {
            rendererIds.add(Number(rendererId));
            profilingStore.registerRenderer(Number(rendererId));
          }
          return null;
        }

        case 'isReloadAndProfileSupportedByBackend': {
          const payload = getRecord(message.payload);
          profilingStore.ingestProfilingStatus({
            supportsReloadAndProfile: payload?.isSupported === true,
          });
          return null;
        }

        default:
          return null;
      }
    },

    send,

    startProfiling(): void {
      profilingStore.startProfiling();
      send('startProfiling', {
        recordChangeDescriptions: true,
        recordTimeline: false,
      });
    },

    stopProfiling(): void {
      profilingStore.stopProfiling();
      send('stopProfiling', undefined);
      rendererIds.forEach((rendererId) => {
        send('getProfilingData', { rendererID: rendererId });
      });
    },

    reloadAndProfile(): void {
      const status = profilingStore.getStatus(componentTreeStore.getRootsCount());
      if (status.supportsReloadAndProfile !== true) {
        throw new Error('Reload-and-profile is not supported by this React DevTools connection.');
      }

      send('reloadAndProfile', {
        recordChangeDescriptions: true,
        recordTimeline: false,
      });
    },

    getProfilingStatus(): ReactProfilingStatus {
      return profilingStore.getStatus(componentTreeStore.getRootsCount());
    },

    getProfilingDataSnapshot(): unknown {
      return profilingStore.getSnapshot();
    },

    getCommitData(rootId: number, commitIndex: number): unknown {
      return profilingStore.getCommitData(rootId, commitIndex);
    },
  };
};
