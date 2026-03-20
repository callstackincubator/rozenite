import { createComponentTreeStore } from './component-tree-store.js';
import { createInspectionStore } from './inspection-store.js';
import {
  createProfilingStore,
  normalizeProfilingDataEvent,
  type NormalizedProfilingStatusEvent,
} from './profiling-store.js';
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

const normalizeProfilingStatusEvent = (payload: unknown): NormalizedProfilingStatusEvent => {
  if (typeof payload === 'boolean') {
    return {
      isProfiling: payload,
    };
  }

  const record = getRecord(payload);
  if (!record) {
    return {};
  }

  const update: NormalizedProfilingStatusEvent = {};
  if (typeof record.isProfiling === 'boolean') {
    update.isProfiling = record.isProfiling;
  }
  if (typeof record.isProfilingStarted === 'boolean') {
    update.isProfiling = record.isProfilingStarted;
  }
  if (typeof record.supportsProfiling === 'boolean') {
    update.supportsProfiling = record.supportsProfiling;
  }
  if (typeof record.supportsReloadAndProfile === 'boolean') {
    update.supportsReloadAndProfile = record.supportsReloadAndProfile;
  }
  if (typeof record.recordChangeDescriptions === 'boolean') {
    update.supportsProfiling = update.supportsProfiling || record.recordChangeDescriptions;
  }

  return update;
};

const normalizeReloadAndProfileSupport = (payload: unknown): boolean | null => {
  if (typeof payload === 'boolean') {
    return payload;
  }

  const record = getRecord(payload);
  if (!record) {
    return null;
  }

  if (typeof record.isSupported === 'boolean') {
    return record.isSupported;
  }

  return null;
};

export const createReactDevToolsBridge = async (options?: {
  sendMessage?: (message: { event: string; payload: unknown }) => void;
}): Promise<ReactDevToolsBridge> => {
  const componentTreeStore = createComponentTreeStore();
  const inspectionStore = createInspectionStore();
  const profilingStore = createProfilingStore();

  const send = (event: string, payload: unknown): void => {
    options?.sendMessage?.({ event, payload });
  };

  return {
    ingest(message: { event: string; payload: unknown }): ReactTreeSyncPayload | null {
      switch (message.event) {
        case 'operations': {
          const rendererId = getRendererIdFromOperations(message.payload);
          if (rendererId !== null) {
            profilingStore.registerRenderer(rendererId);
            profilingStore.noteProfilingOperation(rendererId);
          }
          return componentTreeStore.ingestOperations(message.payload);
        }

        case 'inspectedElement':
          inspectionStore.ingestInspectedElement(message.payload);
          return null;

        case 'profilingStatus':
          profilingStore.ingestProfilingStatus(
            normalizeProfilingStatusEvent(message.payload),
          ).requestProfilingDataForRendererIds.forEach((rendererId) => {
            send('getProfilingData', { rendererID: rendererId });
          });
          return null;

        case 'profilingData':
          profilingStore.ingestProfilingData(normalizeProfilingDataEvent(message.payload));
          return null;

        case 'renderer':
        case 'rendererAttached': {
          const payload = getRecord(message.payload);
          const rendererId = payload?.id;
          if (Number.isInteger(rendererId)) {
            profilingStore.registerRenderer(Number(rendererId));
          }
          return null;
        }

        case 'isReloadAndProfileSupportedByBackend': {
          const isSupported = normalizeReloadAndProfileSupport(message.payload);
          if (isSupported !== null) {
            profilingStore.setReloadAndProfileSupported(isSupported);
          }
          return null;
        }

        default:
          return null;
      }
    },

    send,

    startProfiling(): void {
      profilingStore.requestProfilingStart();
      send('startProfiling', {
        recordChangeDescriptions: true,
        recordTimeline: false,
      });
    },

    stopProfiling(): void {
      profilingStore.requestProfilingStop();
      send('stopProfiling', undefined);
    },

    reloadAndProfile(): void {
      const status = profilingStore.getStatus(componentTreeStore.getRootsCount());
      if (status.supportsReloadAndProfile !== true) {
        throw new Error('Reload-and-profile is not supported by this React DevTools connection.');
      }

      profilingStore.requestProfilingStart();
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
