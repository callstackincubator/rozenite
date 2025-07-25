import {
  NetworkRequestId,
  NetworkLoaderId,
  NetworkResourceType,
  NetworkRequest,
  NetworkResponse,
  NetworkInitiator,
} from '../types/client';

export type NetworkRequestMetadata = {
  id: NetworkRequestId;
  loaderId?: NetworkLoaderId;
  documentURL?: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  postData?: string;
  hasPostData?: boolean;
  type?: NetworkResourceType;
  initiator?: NetworkInitiator;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'loading' | 'finished' | 'failed';
  response?: NetworkResponse;
  errorText?: string;
  canceled?: boolean;
  encodedDataLength?: number;
  dataLength?: number;
};

export type NetworkRegistryEntry = {
  id: string;
  request: XMLHttpRequest;
  metadata: NetworkRequestMetadata;
  sentAt: number;
};

export type NetworkRequestRegistry = {
  addEntry: (
    id: string,
    request: XMLHttpRequest,
    metadata: Partial<NetworkRequestMetadata>
  ) => void;
  getEntry: (id: string) => NetworkRegistryEntry | null;
  updateEntry: (id: string, updates: Partial<NetworkRequestMetadata>) => void;
  getAllEntries: () => Array<NetworkRegistryEntry>;
  clear: () => void;
};

const REQUEST_TTL = 1000 * 60 * 5; // 5 minutes

export const getNetworkRequestsRegistry = (): NetworkRequestRegistry => {
  const registry: Map<string, NetworkRegistryEntry> = new Map();

  const trimRegistry = (): void => {
    const now = Date.now();

    registry.forEach((entry) => {
      if (now - entry.sentAt < REQUEST_TTL) {
        return;
      }

      registry.delete(entry.id);
    });
  };

  const addEntry = (
    id: string,
    request: XMLHttpRequest,
    metadata: Partial<NetworkRequestMetadata>
  ) => {
    trimRegistry();

    const fullMetadata: NetworkRequestMetadata = {
      id,
      method: metadata.method || 'GET',
      url: metadata.url || '',
      headers: metadata.headers || {},
      startTime: metadata.startTime || Date.now(),
      status: metadata.status || 'pending',
      ...metadata,
    };

    registry.set(id, {
      id,
      request,
      metadata: fullMetadata,
      sentAt: Date.now(),
    });
  };

  const getEntry = (id: string) => {
    return registry.get(id) ?? null;
  };

  const updateEntry = (
    id: string,
    updates: Partial<NetworkRequestMetadata>
  ) => {
    const entry = registry.get(id);
    if (entry) {
      entry.metadata = { ...entry.metadata, ...updates };
    }
  };

  const getAllEntries = () => {
    return Array.from(registry.values());
  };

  const clear = () => {
    registry.clear();
  };

  return {
    addEntry,
    getEntry,
    updateEntry,
    getAllEntries,
    clear,
  };
};
