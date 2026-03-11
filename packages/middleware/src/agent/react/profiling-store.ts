const MAX_RENDERER_WAIT_MS = 5000;

type ReactChangeDescription = {
  context: string[] | boolean | null;
  didHooksChange: boolean;
  isFirstMount: boolean;
  props: string[] | null;
  state: string[] | null;
};

type ReactCommitData = {
  changeDescriptions: Map<number, ReactChangeDescription> | null;
  duration: number;
  effectDuration: number | null;
  fiberActualDurations: Map<number, number>;
  fiberSelfDurations: Map<number, number>;
  passiveEffectDuration: number | null;
  priorityLevel: string | null;
  timestamp: number;
  updaters: Array<{ id: number }> | null;
};

type ReactRootProfilingData = {
  commitData: ReactCommitData[];
};

type ProfilingStoreState = {
  supportsProfiling: boolean;
  supportsReloadAndProfile: boolean;
  isProfilingStarted: boolean;
  isProcessingData: boolean;
  dataForRoots: Map<number, ReactRootProfilingData>;
  rendererIds: Set<number>;
};

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const getNumberMap = (value: unknown): Map<number, number> => {
  const result = new Map<number, number>();

  if (value instanceof Map) {
    for (const [key, nested] of value.entries()) {
      const parsedKey = Number(key);
      const parsedValue = Number(nested);
      if (Number.isFinite(parsedKey) && Number.isFinite(parsedValue)) {
        result.set(parsedKey, parsedValue);
      }
    }

    return result;
  }

  if (Array.isArray(value)) {
    if (value.length > 0 && Array.isArray(value[0])) {
      for (const entry of value as unknown[]) {
        if (!Array.isArray(entry) || entry.length < 2) {
          continue;
        }

        const parsedKey = Number(entry[0]);
        const parsedValue = Number(entry[1]);
        if (Number.isFinite(parsedKey) && Number.isFinite(parsedValue)) {
          result.set(parsedKey, parsedValue);
        }
      }

      return result;
    }

    for (let index = 0; index + 1 < value.length; index += 2) {
      const parsedKey = Number(value[index]);
      const parsedValue = Number(value[index + 1]);
      if (Number.isFinite(parsedKey) && Number.isFinite(parsedValue)) {
        result.set(parsedKey, parsedValue);
      }
    }

    return result;
  }

  const record = getRecord(value);
  if (!record) {
    return result;
  }

  for (const [key, nested] of Object.entries(record)) {
    const parsedKey = Number(key);
    const parsedValue = Number(nested);
    if (Number.isFinite(parsedKey) && Number.isFinite(parsedValue)) {
      result.set(parsedKey, parsedValue);
    }
  }

  return result;
};

const getChangeDescriptions = (
  value: unknown,
): Map<number, ReactChangeDescription> | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const result = new Map<number, ReactChangeDescription>();

  const assign = (key: unknown, nested: unknown): void => {
    const parsedKey = Number(key);
    if (!Number.isFinite(parsedKey)) {
      return;
    }

    const record = getRecord(nested) || {};
    const contextValue = record.context;
    const context = contextValue === true
      ? true
      : Array.isArray(contextValue)
        ? contextValue.filter((entry): entry is string => typeof entry === 'string')
        : null;

    result.set(parsedKey, {
      context,
      didHooksChange: record.didHooksChange === true,
      isFirstMount: record.isFirstMount === true,
      props: Array.isArray(record.props)
        ? record.props.filter((entry): entry is string => typeof entry === 'string')
        : null,
      state: Array.isArray(record.state)
        ? record.state.filter((entry): entry is string => typeof entry === 'string')
        : null,
    });
  };

  if (value instanceof Map) {
    for (const [key, nested] of value.entries()) {
      assign(key, nested);
    }
    return result;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!Array.isArray(entry) || entry.length < 2) {
        continue;
      }
      assign(entry[0], entry[1]);
    }

    return result;
  }

  const record = getRecord(value);
  if (record) {
    for (const [key, nested] of Object.entries(record)) {
      assign(key, nested);
    }
  }

  return result;
};

const normalizeCommitData = (value: unknown): ReactCommitData | null => {
  const record = getRecord(value);
  if (!record) {
    return null;
  }

  return {
    changeDescriptions: getChangeDescriptions(record.changeDescriptions),
    duration: Number(record.duration) || 0,
    effectDuration: record.effectDuration === null || record.effectDuration === undefined
      ? null
      : Number(record.effectDuration),
    fiberActualDurations: getNumberMap(record.fiberActualDurations),
    fiberSelfDurations: getNumberMap(record.fiberSelfDurations),
    passiveEffectDuration: record.passiveEffectDuration === null || record.passiveEffectDuration === undefined
      ? null
      : Number(record.passiveEffectDuration),
    priorityLevel: typeof record.priorityLevel === 'string' ? record.priorityLevel : null,
    timestamp: Number(record.timestamp) || 0,
    updaters: Array.isArray(record.updaters)
      ? record.updaters
        .map((entry) => {
          const parsed = getRecord(entry);
          if (!parsed || !Number.isInteger(parsed.id)) {
            return null;
          }

          return {
            id: Number(parsed.id),
          };
        })
        .filter((entry): entry is { id: number } => entry !== null)
      : null,
  };
};

const normalizeRootData = (value: unknown): ReactRootProfilingData => {
  const record = getRecord(value) || {};
  const commitData: ReactCommitData[] = [];

  if (Array.isArray(record.commitData)) {
    for (const commit of record.commitData) {
      const normalized = normalizeCommitData(commit);
      if (normalized) {
        commitData.push(normalized);
      }
    }
  }

  return {
    commitData,
  };
};

const normalizeDataForRoots = (payload: unknown): Map<number, ReactRootProfilingData> => {
  const result = new Map<number, ReactRootProfilingData>();
  const payloadRecord = getRecord(payload);
  if (!payloadRecord) {
    return result;
  }

  const rawDataForRoots = payloadRecord.dataForRoots;

  if (rawDataForRoots instanceof Map) {
    for (const [rootId, rootData] of rawDataForRoots.entries()) {
      const parsedRootId = Number(rootId);
      if (!Number.isFinite(parsedRootId)) {
        continue;
      }

      result.set(parsedRootId, normalizeRootData(rootData));
    }

    return result;
  }

  if (Array.isArray(rawDataForRoots)) {
    rawDataForRoots.forEach((entry, index) => {
      const record = getRecord(entry);
      if (!record) {
        return;
      }

      const rootIdValue = record.rootID ?? record.rootId ?? record.id ?? index;
      const rootId = Number(rootIdValue);
      if (!Number.isFinite(rootId)) {
        return;
      }

      result.set(rootId, normalizeRootData(record));
    });

    return result;
  }

  const rootsRecord = getRecord(rawDataForRoots);
  if (rootsRecord) {
    for (const [rootIdKey, rootData] of Object.entries(rootsRecord)) {
      const rootId = Number(rootIdKey);
      if (!Number.isFinite(rootId)) {
        continue;
      }

      result.set(rootId, normalizeRootData(rootData));
    }

    return result;
  }

  if (Array.isArray(payloadRecord.commitData)) {
    result.set(0, normalizeRootData(payloadRecord));
  }

  return result;
};

export const createProfilingStore = () => {
  const state: ProfilingStoreState = {
    supportsProfiling: true,
    supportsReloadAndProfile: false,
    isProfilingStarted: false,
    isProcessingData: false,
    dataForRoots: new Map(),
    rendererIds: new Set(),
  };

  let processingTimer: NodeJS.Timeout | null = null;

  const clearProcessingTimer = (): void => {
    if (processingTimer) {
      clearTimeout(processingTimer);
      processingTimer = null;
    }
  };

  const scheduleProcessingReset = (): void => {
    clearProcessingTimer();
    processingTimer = setTimeout(() => {
      state.isProcessingData = false;
      processingTimer = null;
    }, MAX_RENDERER_WAIT_MS);
  };

  return {
    ingestProfilingStatus: (payload: unknown): void => {
      const record = getRecord(payload);
      if (!record) {
        return;
      }

      if (typeof record.supportsProfiling === 'boolean') {
        state.supportsProfiling = record.supportsProfiling;
      }
      if (typeof record.supportsReloadAndProfile === 'boolean') {
        state.supportsReloadAndProfile = record.supportsReloadAndProfile;
      }
      if (typeof record.isProfiling === 'boolean') {
        state.isProfilingStarted = record.isProfiling;
      }
      if (typeof record.isProfilingStarted === 'boolean') {
        state.isProfilingStarted = record.isProfilingStarted;
      }
      if (typeof record.isProcessingData === 'boolean') {
        state.isProcessingData = record.isProcessingData;
      }
      if (typeof record.recordChangeDescriptions === 'boolean') {
        state.supportsProfiling = state.supportsProfiling || record.recordChangeDescriptions;
      }
    },

    ingestProfilingData: (payload: unknown): void => {
      const dataForRoots = normalizeDataForRoots(payload);
      if (dataForRoots.size > 0) {
        for (const [rootId, rootData] of dataForRoots.entries()) {
          state.dataForRoots.set(rootId, rootData);
        }
      }

      state.isProcessingData = false;
      clearProcessingTimer();
    },

    registerRenderer: (rendererId: unknown): void => {
      if (Number.isInteger(rendererId)) {
        state.rendererIds.add(Number(rendererId));
      }
    },

    startProfiling: (): void => {
      state.isProfilingStarted = true;
      state.isProcessingData = false;
      state.dataForRoots.clear();
      clearProcessingTimer();
    },

    stopProfiling: (): void => {
      state.isProfilingStarted = false;
      state.isProcessingData = true;
      scheduleProcessingReset();
    },

    getStatus: (rootsCount: number): {
      supportsProfiling: boolean;
      supportsReloadAndProfile: boolean;
      isProfilingStarted: boolean;
      isProcessingData: boolean;
      hasProfilingData: boolean;
      rootsWithData: number;
      rootsCount: number;
    } => {
      return {
        supportsProfiling: state.supportsProfiling,
        supportsReloadAndProfile: state.supportsReloadAndProfile,
        isProfilingStarted: state.isProfilingStarted,
        isProcessingData: state.isProcessingData,
        hasProfilingData: state.dataForRoots.size > 0,
        rootsWithData: state.dataForRoots.size,
        rootsCount,
      };
    },

    getSnapshot: (): { dataForRoots: Map<number, ReactRootProfilingData> } => {
      return {
        dataForRoots: state.dataForRoots,
      };
    },

    getCommitData: (rootId: number, commitIndex: number): ReactCommitData => {
      const rootData = state.dataForRoots.get(rootId);
      const commitData = rootData?.commitData[commitIndex];
      if (!commitData) {
        throw new Error(`Could not find commit data for root "${rootId}" and commit "${commitIndex}"`);
      }

      return commitData;
    },
  };
};
