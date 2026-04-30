import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Input,
  ListBox,
  PluginHeader,
  PluginTheme,
  Select,
  Surface,
  Switch,
  TextField,
} from '@rozenite/ui';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type {
  ControlsEventMap,
  ControlsSnapshotEvent,
  ControlsUpdateResultEvent,
} from '../shared/messaging';
import type {
  ControlsItemSnapshot,
  ControlsSectionSnapshot,
} from '../shared/types';
import './globals.css';

type ItemUiState = {
  pending: boolean;
  message?: string;
};

const getItemKey = (sectionId: string, itemId: string) =>
  `${sectionId}:${itemId}`;

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
  <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description ? (
        <Description className="mt-1 text-xs text-muted">
          {description}
        </Description>
      ) : null}
      {errorMessage ? (
        <FieldError className="mt-1">{errorMessage}</FieldError>
      ) : null}
    </div>
    <div className="flex w-full shrink-0 items-center justify-end sm:w-auto">
      {children}
    </div>
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
      <Switch
        aria-label={item.title}
        isDisabled={item.disabled || uiState?.pending}
        isSelected={item.value}
        onChange={(isSelected) => onToggle(sectionId, item.id, isSelected)}
        size="sm"
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
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
      <Button
        isDisabled={item.disabled || uiState?.pending}
        onPress={() => onPress(sectionId, item.id)}
        size="sm"
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
    <RowShell
      title={item.title}
      description={item.description}
      errorMessage={uiState?.message}
    >
      <Select
        aria-label={item.title}
        className="w-full sm:w-44"
        isDisabled={item.disabled || uiState?.pending}
        onChange={(key) => {
          if (key == null) {
            return;
          }

          onSelect(sectionId, item.id, String(key));
        }}
        value={item.value}
        variant="secondary"
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox aria-label={`${item.title} options`}>
            {item.options.map((option) => (
              <ListBox.Item
                key={option.value}
                id={option.value}
                textValue={option.label}
              >
                {option.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
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
      <Surface
        className="wrap-anywhere w-full max-w-full rounded-md border border-border/70 px-3 py-2 text-left font-mono text-xs text-foreground sm:max-w-72 sm:text-right"
        variant="secondary"
      >
        {item.value}
      </Surface>
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
  const isDisabled = item.disabled || uiState?.pending;

  return (
    <RowShell
      title={item.title}
      description={item.description}
      errorMessage={uiState?.message}
    >
      <div className="flex w-full min-w-0 items-center gap-2 sm:min-w-72">
        <TextField
          aria-label={item.title}
          className="min-w-0 flex-1"
          isDisabled={isDisabled}
          name={getItemKey(sectionId, item.id)}
          type="text"
        >
          <Input
            disabled={isDisabled}
            fullWidth
            onChange={(event) =>
              onDraftChange(sectionId, item.id, event.target.value)
            }
            placeholder={item.placeholder}
            value={draftValue}
            variant="secondary"
          />
        </TextField>
        <Button
          isDisabled={!isChanged || isDisabled}
          onPress={() => onApply(sectionId, item.id)}
          size="sm"
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
  onInputDraftChange: (
    sectionId: string,
    itemId: string,
    value: string,
  ) => void;
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
  const [itemUiState, setItemUiState] = useState<Map<string, ItemUiState>>(
    new Map(),
  );
  const [inputDrafts, setInputDrafts] = useState<Map<string, string>>(
    new Map(),
  );
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
              nextCommittedValues.set(
                getItemKey(section.id, item.id),
                item.value,
              );
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
              previousDraft !== undefined &&
              previousDraft !== previousCommitted;

            if (!isDirty || previousDraft === committedValue) {
              next.set(key, committedValue);
            }
          });

          return next;
        });

        committedInputValuesRef.current = nextCommittedValues;
      },
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

  const sendUpdateRequest = (
    sectionId: string,
    itemId: string,
    value: boolean | string,
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
    value: string,
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
    <PluginTheme
      defaultTheme="dark"
      storageKey="@rozenite/controls-plugin.theme"
      className="flex h-screen flex-col bg-background text-foreground"
    >
      <PluginHeader
        title="Controls"
        actions={
          <Chip className="shrink-0" variant="secondary">
            {sections.length} sections
          </Chip>
        }
      />

      <div className="flex-1 overflow-auto p-4 pt-3">
        {loading ? (
          <Surface className="text-sm text-muted" variant="secondary">
            Loading controls snapshot...
          </Surface>
        ) : null}

        {!loading && sections.length === 0 ? (
          <Surface className="text-sm text-muted" variant="secondary">
            No controls registered on the device.
          </Surface>
        ) : null}

        <div className="space-y-4">
          {sections.map((section) => (
            <Card key={section.id}>
              <Card.Header>
                <Card.Title>{section.title}</Card.Title>
                {section.description ? (
                  <Card.Description className="mt-1 text-xs">
                    {section.description}
                  </Card.Description>
                ) : null}
              </Card.Header>

              <Card.Content>
                {section.items.map((item) => (
                  <div key={item.id}>
                    {renderItem({
                      sectionId: section.id,
                      item,
                      uiState: itemUiState.get(getItemKey(section.id, item.id)),
                      inputDraft: inputDrafts.get(
                        getItemKey(section.id, item.id),
                      ),
                      onToggle: handleToggle,
                      onPress: handlePress,
                      onSelect: handleSelect,
                      onInputDraftChange: handleInputDraftChange,
                      onInputApply: handleInputApply,
                    })}
                  </div>
                ))}
              </Card.Content>
            </Card>
          ))}
        </div>
      </div>
    </PluginTheme>
  );
}
