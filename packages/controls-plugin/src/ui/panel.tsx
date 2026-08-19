import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  Button,
  EmptyState,
  Input,
  PluginShell,
  Select,
  Sidebar,
  Split,
  Switch,
} from '@rozenite/ui';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type {
  ControlsEventMap,
  ControlsSnapshotEvent,
  ControlsUpdateResultEvent,
} from '../shared/messaging';
import type { ControlsItemSnapshot, ControlsSectionSnapshot } from '../shared/types';
import '@rozenite/ui/styles.css';

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
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description ? <div className="mt-1 text-xs text-muted-foreground">{description}</div> : null}
      {errorMessage ? <div className="mt-1 text-xs text-danger">{errorMessage}</div> : null}
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
    <RowShell title={item.title} description={item.description} errorMessage={uiState?.message}>
      <Switch
        aria-label={item.title}
        checked={item.value}
        disabled={item.disabled || uiState?.pending}
        onCheckedChange={(checked) => onToggle(sectionId, item.id, checked)}
      />
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
    <RowShell title={item.title} description={item.description} errorMessage={uiState?.message}>
      <Button
        size="sm"
        tone="neutral"
        variant="outline"
        disabled={item.disabled || uiState?.pending}
        onClick={() => onPress(sectionId, item.id)}
      >
        {uiState?.pending ? 'Running...' : (item.actionLabel ?? 'Run')}
      </Button>
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
    <RowShell title={item.title} description={item.description} errorMessage={uiState?.message}>
      <Select
        value={item.value}
        disabled={item.disabled || uiState?.pending}
        onValueChange={(value) => {
          if (value !== null) {
            onSelect(sectionId, item.id, value);
          }
        }}
      >
        <Select.Trigger className="w-40">
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {item.options.map((option) => (
            <Select.Item key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    </RowShell>
  );
};

const TextRow = ({ item }: { item: Extract<ControlsItemSnapshot, { type: 'text' }> }) => {
  return (
    <RowShell title={item.title} description={item.description}>
      <div className="max-w-[50%] rounded-md bg-muted px-3 py-1.5 text-right text-xs text-muted-foreground">
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
    <RowShell title={item.title} description={item.description} errorMessage={uiState?.message}>
      <div className="flex min-w-[240px] items-center gap-2">
        <Input
          className="flex-1"
          type="text"
          value={draftValue}
          placeholder={item.placeholder}
          disabled={item.disabled || uiState?.pending}
          onChange={(event) => onDraftChange(sectionId, item.id, event.target.value)}
        />
        <Button
          size="sm"
          tone="neutral"
          variant="outline"
          disabled={!isChanged || item.disabled || uiState?.pending}
          onClick={() => onApply(sectionId, item.id)}
        >
          {uiState?.pending ? 'Applying...' : (item.applyLabel ?? 'Apply')}
        </Button>
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
    return <ToggleRow sectionId={sectionId} item={item} uiState={uiState} onToggle={onToggle} />;
  }

  if (item.type === 'select') {
    return <SelectRow sectionId={sectionId} item={item} uiState={uiState} onSelect={onSelect} />;
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

  return <ButtonRow sectionId={sectionId} item={item} uiState={uiState} onPress={onPress} />;
};

export default function ControlsPanel() {
  const [sections, setSections] = useState<ControlsSectionSnapshot[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
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

    const snapshotSubscription = client.onMessage('snapshot', (event: ControlsSnapshotEvent) => {
      setSections(event.sections);
      setSelectedSectionId((previous) =>
        event.sections.some((section) => section.id === previous)
          ? previous
          : (event.sections[0]?.id ?? null),
      );
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
          const isDirty = previousDraft !== undefined && previousDraft !== previousCommitted;

          if (!isDirty || previousDraft === committedValue) {
            next.set(key, committedValue);
          }
        });

        return next;
      });

      committedInputValuesRef.current = nextCommittedValues;
    });
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
      },
    );

    client.send('get-snapshot', {
      type: 'get-snapshot',
    });

    return () => {
      snapshotSubscription.remove();
      updateResultSubscription.remove();
    };
  }, [client]);

  const sendUpdateRequest = (sectionId: string, itemId: string, value: boolean | string) => {
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

  const handleInputDraftChange = (sectionId: string, itemId: string, value: string) => {
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

  const selectedSection = sections.find((section) => section.id === selectedSectionId);

  return (
    <PluginShell className="dark">
      <PluginShell.Body>
        {loading ? <EmptyState title="Loading controls…" /> : null}

        {!loading && sections.length === 0 ? (
          <EmptyState
            title="No controls registered"
            description="Register controls in the app to manage them here."
          />
        ) : null}

        {!loading && selectedSection ? (
          <Split direction="horizontal" autoSaveId="controls-sections">
            <Split.Pane defaultSize={22} minSize={15} maxSize={35}>
              <Sidebar className="w-full border-r-0">
                <Sidebar.Group>
                  {sections.map((section) => (
                    <Sidebar.Item
                      key={section.id}
                      selected={section.id === selectedSection.id}
                      onClick={() => setSelectedSectionId(section.id)}
                    >
                      {section.title}
                    </Sidebar.Item>
                  ))}
                </Sidebar.Group>
              </Sidebar>
            </Split.Pane>
            <Split.Handle />
            <Split.Pane>
              <section className="h-full overflow-auto p-6">
                <h1 className="text-base font-semibold text-foreground">{selectedSection.title}</h1>
                {selectedSection.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedSection.description}
                  </p>
                ) : null}
                <div className="mt-5 divide-y divide-border">
                  {selectedSection.items.map((item) => (
                    <div key={item.id}>
                      {renderItem({
                        sectionId: selectedSection.id,
                        item,
                        uiState: itemUiState.get(getItemKey(selectedSection.id, item.id)),
                        inputDraft: inputDrafts.get(getItemKey(selectedSection.id, item.id)),
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
            </Split.Pane>
          </Split>
        ) : null}
      </PluginShell.Body>
    </PluginShell>
  );
}
