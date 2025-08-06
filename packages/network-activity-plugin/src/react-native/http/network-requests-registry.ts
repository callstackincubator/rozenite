type NetworkRegistryEntry = {
  id: string;
  sentAt: number;
  request: XMLHttpRequest;
};

export type NetworkRequestRegistry = {
  addEntry: (id: string, request: XMLHttpRequest) => void;
  getEntry: (id: string) => XMLHttpRequest | null;
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
    registry.set(id, {
      id,
      request,
      sentAt: Date.now(),
    });
  };

  const getEntry = (id: string): XMLHttpRequest | null => {
    return registry.get(id)?.request ?? null;
  };

  const clear = () => {
    registry.clear();
  };

  return {
    addEntry,
    getEntry,
    clear,
  };
};
