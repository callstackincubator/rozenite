import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type {
  ControlsEventMap,
  ControlsSnapshotEvent,
  ControlsUpdateResultEvent,
} from '../shared/messaging';
import type { ControlsItemSnapshot, ControlsSectionSnapshot } from '../shared/types';
import './globals.css';

type ItemUiState = {
  pending: boolean;
  message?: string;
};

const getItemKey = (sectionId: string, itemId: string) => `${sectionId}:${itemId}`;

const createRequestId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const RowShell = ({
  title,
  description,
  errorMessage,
  children,
}: {
  title: string;
  description?: string;
  errorMessage?: string;
  children: ReactNode;
}) => (
  <div className="flex items-start justify-between gap-4 py-3">
    <div className="min-w-0">
      <div className="text-sm font-medium text-gray-100">{title}</div>
      {description ? (
        <div className="mt-1 text-xs text-gray-400">{description}</div>
      ) : null}
      {errorMessage ? (
        <div className="mt-1 text-xs text-red-400">{errorMessage}</div>
      ) : null}
    </div>
    {children}
  </div>
);

const ToggleRow = ({
  sectionId,
  item,
  uiState,
  onToggle,
}: {
  sectionId: string;
  item: Extract<ControlsItemSnapshot, { type: 'toggle' }>;
  uiState?: ItemUiState;
  onToggle: (sectionId: string, itemId: string, value: boolean) => void;
}) => {
  return (
    <RowShell
      title={item.title}
      description={item.description}
      errorMessage={uiState?.message}
    >
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={item.value}
          disabled={item.disabled || uiState?.pending}
          onChange={(event) => onToggle(sectionId, item.id, event.target.checked)}
        />
        <div className="h-6 w-11 rounded-full bg-gray-700 transition peer-checked:bg-violet-500 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-5" />
      </label>
    </RowShell>
  );
};

const ButtonRow = ({
  sectionId,
  item,
  uiState,
  onPress,
}: {
  sectionId: string;
  item: Extract<ControlsItemSnapshot, { type: 'button' }>;
  uiState?: ItemUiState;
  onPress: (sectionId: string, itemId: string) => void;
}) => {
  return (
    <RowShell
      title={item.title}
      description={item.description}
      errorMessage={uiState?.message}
    >
      <button
        className="rounded-md border border-violet-500/60 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
        disabled={item.disabled || uiState?.pending}
        onClick={() => onPress(sectionId, item.id)}
      >
        {uiState?.pending ? 'Running...' : item.actionLabel ?? 'Run'}
      </button>
    </RowShell>
  );
};

const SelectRow = ({
  sectionId,
  item,
  uiState,
  onSelect,
}: {
  sectionId: string;
  item: Extract<ControlsItemSnapshot, { type: 'select' }>;
  uiState?: ItemUiState;
  onSelect: (sectionId: string, itemId: string, value: string) => void;
}) => {
  return (
    <RowShell
      title={item.title}
      description={item.description}
      errorMessage={uiState?.message}
    >
      <select
        className="min-w-[160px] rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-200 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        value={item.value}
        disabled={item.disabled || uiState?.pending}
        onChange={(event) => onSelect(sectionId, item.id, event.target.value)}
      >
        {item.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </RowShell>
  );
};

const TextRow = ({
  item,
}: {
  item: Extract<ControlsItemSnapshot, { type: 'text' }>;
}) => {
  return (
    <RowShell title={item.title} description={item.description}>
      <div className="max-w-[50%] rounded-md bg-gray-950/80 px-3 py-1.5 text-right text-xs text-gray-300">
        {item.value}
      </div>
    </RowShell>
  );
};

const InputRow = ({
  sectionId,
  item,
  uiState,
  draftValue,
  onDraftChange,
  onApply,
}: {
  sectionId: string;
  item: Extract<ControlsItemSnapshot, { type: 'input' }>;
  uiState?: ItemUiState;
  draftValue: string;
  onDraftChange: (sectionId: string, itemId: string, value: string) => void;
  onApply: (sectionId: string, itemId: string) => void;
}) => {
  const isChanged = draftValue !== item.value;

  return (
    <RowShell
      title={item.title}
      description={item.description}
      errorMessage={uiState?.message}
    >
      <div className="flex min-w-[240px] items-center gap-2">
        <input
          className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-200 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          type="text"
          value={draftValue}
          placeholder={item.placeholder}
          disabled={item.disabled || uiState?.pending}
          onChange={(event) =>
            onDraftChange(sectionId, item.id, event.target.value)
          }
        />
        <button
          className="rounded-md border border-violet-500/60 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
          disabled={!isChanged || item.disabled || uiState?.pending}
          onClick={() => onApply(sectionId, item.id)}
        >
          {uiState?.pending ? 'Applying...' : item.applyLabel ?? 'Apply'}
        </button>
      </div>
    </RowShell>
  );
};

const renderItem = ({
  sectionId,
  item,
  uiState,
  inputDraft,
  onToggle,
  onPress,
  onSelect,
  onInputDraftChange,
  onInputApply,
}: {
  sectionId: string;
  item: ControlsItemSnapshot;
  uiState?: ItemUiState;
  inputDraft?: string;
  onToggle: (sectionId: string, itemId: string, value: boolean) => void;
  onPress: (sectionId: string, itemId: string) => void;
  onSelect: (sectionId: string, itemId: string, value: string) => void;
  onInputDraftChange: (sectionId: string, itemId: string, value: string) => void;
  onInputApply: (sectionId: string, itemId: string) => void;
}) => {
  if (item.type === 'text') {
    return <TextRow item={item} />;
  }

  if (item.type === 'toggle') {
    return (
      <ToggleRow
        sectionId={sectionId}
        item={item}
        uiState={uiState}
        onToggle={onToggle}
      />
    );
  }

  if (item.type === 'select') {
    return (
      <SelectRow
        sectionId={sectionId}
        item={item}
        uiState={uiState}
        onSelect={onSelect}
      />
    );
  }

  if (item.type === 'input') {
    return (
      <InputRow
        sectionId={sectionId}
        item={item}
        uiState={uiState}
        draftValue={inputDraft ?? item.value}
        onDraftChange={onInputDraftChange}
        onApply={onInputApply}
      />
    );
  }

  return (
    <ButtonRow
      sectionId={sectionId}
      item={item}
      uiState={uiState}
      onPress={onPress}
    />
  );
};

export default function ControlsPanel() {
  const [sections, setSections] = useState<ControlsSectionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemUiState, setItemUiState] = useState<Map<string, ItemUiState>>(new Map());
  const [inputDrafts, setInputDrafts] = useState<Map<string, string>>(new Map());
  const committedInputValuesRef = useRef<Map<string, string>>(new Map());

  const client = useRozeniteDevToolsClient<ControlsEventMap>({
    pluginId: '@rozenite/controls-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const snapshotSubscription = client.onMessage(
      'snapshot',
      (event: ControlsSnapshotEvent) => {
        setSections(event.sections);
        setLoading(false);

        const nextCommittedValues = new Map<string, string>();
        event.sections.forEach((section) => {
          section.items.forEach((item) => {
            if (item.type === 'input') {
              nextCommittedValues.set(getItemKey(section.id, item.id), item.value);
            }
          });
        });

        setInputDrafts((previous) => {
          const next = new Map(previous);

          next.forEach((_value, key) => {
            if (!nextCommittedValues.has(key)) {
              next.delete(key);
            }
          });

          nextCommittedValues.forEach((committedValue, key) => {
            const previousCommitted = committedInputValuesRef.current.get(key);
            const previousDraft = previous.get(key);
            const isDirty =
              previousDraft !== undefined && previousDraft !== previousCommitted;

            if (!isDirty || previousDraft === committedValue) {
              next.set(key, committedValue);
            }
          });

          return next;
        });

        committedInputValuesRef.current = nextCommittedValues;
      }
    );
    const updateResultSubscription = client.onMessage(
      'update-result',
      (event: ControlsUpdateResultEvent) => {
        const key = getItemKey(event.sectionId, event.itemId);

        setItemUiState((previous) => {
          const next = new Map(previous);
          next.set(key, {
            pending: false,
            message: event.status === 'error' ? event.message : undefined,
          });
          return next;
        });
      }
    );

    client.send('get-snapshot', {
      type: 'get-snapshot',
    });

    return () => {
      snapshotSubscription.remove();
      updateResultSubscription.remove();
    };
  }, [client]);

  const sendUpdateRequest = (
    sectionId: string,
    itemId: string,
    value: boolean | string
  ) => {
    if (!client) {
      return;
    }

    const requestId = createRequestId();
    const key = getItemKey(sectionId, itemId);

    setItemUiState((previous) => {
      const next = new Map(previous);
      next.set(key, {
        pending: true,
        message: undefined,
      });
      return next;
    });

    client.send('update-request', {
      type: 'update-request',
      requestId,
      sectionId,
      itemId,
      value,
    });
  };

  const handleToggle = (sectionId: string, itemId: string, value: boolean) => {
    sendUpdateRequest(sectionId, itemId, value);
  };

  const handlePress = (sectionId: string, itemId: string) => {
    if (!client) {
      return;
    }

    client.send('invoke-action', {
      type: 'invoke-action',
      sectionId,
      itemId,
      action: 'press',
    });
  };

  const handleSelect = (sectionId: string, itemId: string, value: string) => {
    sendUpdateRequest(sectionId, itemId, value);
  };

  const handleInputDraftChange = (
    sectionId: string,
    itemId: string,
    value: string
  ) => {
    const key = getItemKey(sectionId, itemId);

    setInputDrafts((previous) => {
      const next = new Map(previous);
      next.set(key, value);
      return next;
    });

    setItemUiState((previous) => {
      const next = new Map(previous);
      const current = next.get(key);
      if (current?.message) {
        next.set(key, {
          ...current,
          message: undefined,
        });
      }
      return next;
    });
  };

  const handleInputApply = (sectionId: string, itemId: string) => {
    const key = getItemKey(sectionId, itemId);
    const draftValue = inputDrafts.get(key);

    if (draftValue === undefined) {
      return;
    }

    sendUpdateRequest(sectionId, itemId, draftValue);
  };

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col">
      <div className="flex items-center gap-2 border-b border-gray-700 bg-gray-800 p-2">
        <span className="text-sm font-medium text-gray-200">Controls</span>
        <div className="flex-1" />
        <span className="text-xs text-gray-400">{sections.length} sections</span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="rounded-lg border border-gray-800 bg-gray-800 p-6 text-sm text-gray-400">
            Loading controls snapshot...
          </div>
        ) : null}

        {!loading && sections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-700 bg-gray-800/80 p-6 text-sm text-gray-400">
            No controls registered on the device.
          </div>
        ) : null}

        <div className="space-y-4">
          {sections.map((section) => (
            <section
              key={section.id}
              className="rounded-xl border border-gray-800 bg-gray-800/90 shadow-lg shadow-black/10"
            >
              <div className="border-b border-gray-800 px-4 py-3">
                <div className="text-sm font-semibold text-gray-100">
                  {section.title}
                </div>
                {section.description ? (
                  <div className="mt-1 text-xs text-gray-400">
                    {section.description}
                  </div>
                ) : null}
              </div>

              <div className="divide-y divide-gray-800 px-4">
                {section.items.map((item) => (
                  <div key={item.id}>
                    {renderItem({
                      sectionId: section.id,
                      item,
                      uiState: itemUiState.get(getItemKey(section.id, item.id)),
                      inputDraft: inputDrafts.get(getItemKey(section.id, item.id)),
                      onToggle: handleToggle,
                      onPress: handlePress,
                      onSelect: handleSelect,
                      onInputDraftChange: handleInputDraftChange,
                      onInputApply: handleInputApply,
                    })}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
