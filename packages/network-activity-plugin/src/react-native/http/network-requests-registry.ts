import type { ResponseBody } from '../../shared/client';

type NetworkRegistryEntry = {
  id: string;
  sentAt: number;
  request?: XMLHttpRequest;
  responseBody?: ResponseBody;
};

export type NetworkRequestRegistry = {
  addEntry: (id: string, request: XMLHttpRequest) => void;
  getEntry: (id: string) => XMLHttpRequest | null;
  setResponseBody: (id: string, body: ResponseBody) => void;
  getResponseBody: (id: string) => ResponseBody | undefined;
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

  const addEntry = (id: string, request: XMLHttpRequest): void => {
    trimRegistry();
    const existing = registry.get(id);

    registry.set(id, {
      id,
      request,
      responseBody: existing?.responseBody,
      sentAt: existing?.sentAt ?? Date.now(),
    });
  };

  const getEntry = (id: string): XMLHttpRequest | null => {
    return registry.get(id)?.request ?? null;
  };

  const setResponseBody = (id: string, body: ResponseBody): void => {
    trimRegistry();
    const existing = registry.get(id);

    registry.set(id, {
      id,
      request: existing?.request,
      responseBody: body,
      sentAt: existing?.sentAt ?? Date.now(),
    });
  };

  const getResponseBody = (id: string): ResponseBody | undefined => {
    return registry.get(id)?.responseBody;
  };

  const clear = () => {
    registry.clear();
  };

  return {
    addEntry,
    getEntry,
    setResponseBody,
    getResponseBody,
    clear,
  };
};
