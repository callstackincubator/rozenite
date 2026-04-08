type InspectedNodeRecord = {
  props?: unknown;
  state?: unknown;
  hooks?: unknown;
};

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const normalizeDehydratedValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeDehydratedValue(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, unknown>;

  if (
    record.data !== undefined
    && record.cleaned === undefined
    && record.name === undefined
    && record.props === undefined
    && record.state === undefined
  ) {
    return normalizeDehydratedValue(record.data);
  }

  const entries = Object.entries(record);
  return Object.fromEntries(
    entries.map(([key, nested]) => [key, normalizeDehydratedValue(nested)] as const),
  );
};

export const createInspectionStore = () => {
  const byNodeId = new Map<number, InspectedNodeRecord>();

  const ingestInspectedElement = (payload: unknown): { nodeId: number; exists: boolean } | null => {
    const source = getRecord(payload);
    if (!source || !Number.isInteger(source.id)) {
      return null;
    }

    const nodeId = Number(source.id);
    if (source.type === 'not-found') {
      byNodeId.delete(nodeId);
      return { nodeId, exists: false };
    }

    const value = getRecord(source.value) || source;
    const next: InspectedNodeRecord = {
      ...(value.props !== undefined ? { props: normalizeDehydratedValue(value.props) } : {}),
      ...(value.state !== undefined ? { state: normalizeDehydratedValue(value.state) } : {}),
      ...(value.hooks !== undefined ? { hooks: normalizeDehydratedValue(value.hooks) } : {}),
    };

    if (next.props === undefined && next.state === undefined && next.hooks === undefined) {
      byNodeId.delete(nodeId);
      return { nodeId, exists: false };
    }

    byNodeId.set(nodeId, next);
    return {
      nodeId,
      exists: true,
    };
  };

  return {
    ingestInspectedElement,
    get: (nodeId: number): InspectedNodeRecord | undefined => {
      return byNodeId.get(nodeId);
    },
  };
};
