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

type ProfilingPhase =
  | 'idle'
  | 'profiling'
  | 'stopping'
  | 'processing'
  | 'complete';

export type NormalizedProfilingStatusEvent = {
  isProfiling?: boolean;
  supportsProfiling?: boolean;
  supportsReloadAndProfile?: boolean;
};

export type NormalizedProfilingDataEvent = {
  rendererId?: number;
  dataForRoots: Map<number, ReactRootProfilingData>;
};

type ProfilingSessionState = {
  phase: ProfilingPhase;
  dataForRoots: Map<number, ReactRootProfilingData>;
  rendererIdByRootId: Map<number, number>;
  participatingRendererIds: Set<number>;
  pendingRendererIds: Set<number>;
  receivedRendererIds: Set<number>;
  conflictingRootIds: Set<number>;
};

type ProfilingStoreState = {
  supportsProfiling: boolean;
  supportsReloadAndProfile: boolean;
  knownRendererIds: Set<number>;
  session: ProfilingSessionState;
};

const createEmptySession = (): ProfilingSessionState => ({
  phase: 'idle',
  dataForRoots: new Map(),
  rendererIdByRootId: new Map(),
  participatingRendererIds: new Set(),
  pendingRendererIds: new Set(),
  receivedRendererIds: new Set(),
  conflictingRootIds: new Set(),
});

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
    const context =
      contextValue === true
        ? true
        : Array.isArray(contextValue)
          ? contextValue.filter(
              (entry): entry is string => typeof entry === 'string',
            )
          : null;

    result.set(parsedKey, {
      context,
      didHooksChange: record.didHooksChange === true,
      isFirstMount: record.isFirstMount === true,
      props: Array.isArray(record.props)
        ? record.props.filter(
            (entry): entry is string => typeof entry === 'string',
          )
        : null,
      state: Array.isArray(record.state)
        ? record.state.filter(
            (entry): entry is string => typeof entry === 'string',
          )
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
    effectDuration:
      record.effectDuration === null || record.effectDuration === undefined
        ? null
        : Number(record.effectDuration),
    fiberActualDurations: getNumberMap(record.fiberActualDurations),
    fiberSelfDurations: getNumberMap(record.fiberSelfDurations),
    passiveEffectDuration:
      record.passiveEffectDuration === null ||
      record.passiveEffectDuration === undefined
        ? null
        : Number(record.passiveEffectDuration),
    priorityLevel:
      typeof record.priorityLevel === 'string' ? record.priorityLevel : null,
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

const normalizeDataForRoots = (
  payload: unknown,
): Map<number, ReactRootProfilingData> => {
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

export const normalizeProfilingDataEvent = (
  payload: unknown,
): NormalizedProfilingDataEvent => {
  const record = getRecord(payload);
  const rawRendererId = record?.rendererID ?? record?.rendererId;
  const rendererId = Number.isInteger(rawRendererId)
    ? Number(rawRendererId)
    : undefined;

  return {
    ...(rendererId !== undefined ? { rendererId } : {}),
    dataForRoots: normalizeDataForRoots(payload),
  };
};

const mergeRootProfilingData = (
  target: Map<number, ReactRootProfilingData>,
  rendererIdByRootId: Map<number, number>,
  conflictingRootIds: Set<number>,
  rendererId: number,
  update: Map<number, ReactRootProfilingData>,
): void => {
  for (const [rootId, rootData] of update.entries()) {
    const existingRendererId = rendererIdByRootId.get(rootId);
    if (existingRendererId !== undefined && existingRendererId !== rendererId) {
      conflictingRootIds.add(rootId);
      continue;
    }

    const existing = target.get(rootId);
    if (!existing) {
      rendererIdByRootId.set(rootId, rendererId);
      target.set(rootId, {
        commitData: [...rootData.commitData],
      });
      continue;
    }

    existing.commitData.push(...rootData.commitData);
  }
};

export const createProfilingStore = () => {
  const state: ProfilingStoreState = {
    supportsProfiling: true,
    supportsReloadAndProfile: false,
    knownRendererIds: new Set(),
    session: createEmptySession(),
  };

  const resetSession = (): void => {
    state.session = createEmptySession();
  };

  const updatePhaseAfterData = (): void => {
    if (state.session.pendingRendererIds.size > 0) {
      state.session.phase = 'processing';
      return;
    }

    state.session.phase =
      state.session.dataForRoots.size > 0 ? 'complete' : 'idle';
  };

  return {
    registerRenderer: (rendererId: unknown): void => {
      if (!Number.isInteger(rendererId)) {
        return;
      }

      state.knownRendererIds.add(Number(rendererId));
    },

    requestProfilingStart: (): void => {
      resetSession();
      state.session.phase = 'profiling';
    },

    requestProfilingStop: (): void => {
      if (state.session.phase === 'profiling') {
        state.session.phase = 'stopping';
      }
    },

    noteProfilingOperation: (rendererId: unknown): void => {
      if (!Number.isInteger(rendererId)) {
        return;
      }

      if (
        state.session.phase !== 'profiling' &&
        state.session.phase !== 'stopping'
      ) {
        return;
      }

      state.session.participatingRendererIds.add(Number(rendererId));
    },

    ingestProfilingStatus: (
      update: NormalizedProfilingStatusEvent,
    ): { requestProfilingDataForRendererIds: number[] } => {
      if (typeof update.supportsProfiling === 'boolean') {
        state.supportsProfiling = update.supportsProfiling;
      }
      if (typeof update.supportsReloadAndProfile === 'boolean') {
        state.supportsReloadAndProfile = update.supportsReloadAndProfile;
      }

      if (typeof update.isProfiling !== 'boolean') {
        return { requestProfilingDataForRendererIds: [] };
      }

      if (update.isProfiling) {
        if (state.session.phase !== 'profiling') {
          resetSession();
          state.session.phase = 'profiling';
        }
        return { requestProfilingDataForRendererIds: [] };
      }

      if (
        state.session.phase !== 'profiling' &&
        state.session.phase !== 'stopping'
      ) {
        if (state.session.pendingRendererIds.size === 0) {
          updatePhaseAfterData();
        }
        return { requestProfilingDataForRendererIds: [] };
      }

      const rendererIds = [...state.session.participatingRendererIds]
        .filter((rendererId) => state.knownRendererIds.has(rendererId))
        .sort((a, b) => a - b);
      state.session.pendingRendererIds = new Set(rendererIds);
      state.session.phase = rendererIds.length > 0 ? 'processing' : 'complete';

      return {
        requestProfilingDataForRendererIds: rendererIds,
      };
    },

    ingestProfilingData: (event: NormalizedProfilingDataEvent): boolean => {
      const { rendererId, dataForRoots } = event;

      if (
        rendererId === undefined ||
        !state.session.pendingRendererIds.has(rendererId)
      ) {
        return false;
      }

      state.session.pendingRendererIds.delete(rendererId);
      state.session.receivedRendererIds.add(rendererId);

      if (dataForRoots.size > 0) {
        mergeRootProfilingData(
          state.session.dataForRoots,
          state.session.rendererIdByRootId,
          state.session.conflictingRootIds,
          rendererId,
          dataForRoots,
        );
      }

      updatePhaseAfterData();
      return true;
    },

    setReloadAndProfileSupported: (isSupported: boolean): void => {
      state.supportsReloadAndProfile = isSupported;
    },

    getStatus: (
      rootsCount: number,
    ): {
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
        isProfilingStarted: state.session.phase === 'profiling',
        isProcessingData:
          state.session.phase === 'stopping' ||
          state.session.phase === 'processing',
        hasProfilingData: state.session.dataForRoots.size > 0,
        rootsWithData: state.session.dataForRoots.size,
        rootsCount,
      };
    },

    getSnapshot: (): {
      phase: ProfilingPhase;
      dataForRoots: Map<number, ReactRootProfilingData>;
      rendererIdByRootId: Map<number, number>;
      participatingRendererIds: Set<number>;
      pendingRendererIds: Set<number>;
      receivedRendererIds: Set<number>;
      conflictingRootIds: Set<number>;
    } => {
      return {
        phase: state.session.phase,
        dataForRoots: state.session.dataForRoots,
        rendererIdByRootId: state.session.rendererIdByRootId,
        participatingRendererIds: state.session.participatingRendererIds,
        pendingRendererIds: state.session.pendingRendererIds,
        receivedRendererIds: state.session.receivedRendererIds,
        conflictingRootIds: state.session.conflictingRootIds,
      };
    },

    getCommitData: (rootId: number, commitIndex: number): ReactCommitData => {
      if (state.session.conflictingRootIds.has(rootId)) {
        throw new Error(
          `Commit data for root "${rootId}" is ambiguous across multiple React renderers.`,
        );
      }

      const rootData = state.session.dataForRoots.get(rootId);
      const commitData = rootData?.commitData[commitIndex];
      if (!commitData) {
        throw new Error(
          `Could not find commit data for root "${rootId}" and commit "${commitIndex}"`,
        );
      }

      return commitData;
    },
  };
};
