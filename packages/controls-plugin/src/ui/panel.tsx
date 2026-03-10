import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useState } from 'react';
import type { ControlsEventMap, ControlsSnapshotEvent } from '../shared/messaging';
import type { ControlsItemSnapshot, ControlsSectionSnapshot } from '../shared/types';
import './globals.css';

const ToggleRow = ({
  sectionId,
  item,
  onToggle,
}: {
  sectionId: string;
  item: Extract<ControlsItemSnapshot, { type: 'toggle' }>;
  onToggle: (sectionId: string, itemId: string, value: boolean) => void;
}) => {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-100">{item.title}</div>
        {item.description ? (
          <div className="mt-1 text-xs text-gray-400">{item.description}</div>
        ) : null}
      </div>
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={item.value}
          disabled={item.disabled}
          onChange={(event) => onToggle(sectionId, item.id, event.target.checked)}
        />
        <div className="h-6 w-11 rounded-full bg-gray-700 transition peer-checked:bg-violet-500 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-5" />
      </label>
    </div>
  );
};

const ButtonRow = ({
  sectionId,
  item,
  onPress,
}: {
  sectionId: string;
  item: Extract<ControlsItemSnapshot, { type: 'button' }>;
  onPress: (sectionId: string, itemId: string) => void;
}) => {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-100">{item.title}</div>
        {item.description ? (
          <div className="mt-1 text-xs text-gray-400">{item.description}</div>
        ) : null}
      </div>
      <button
        className="rounded-md border border-violet-500/60 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
        disabled={item.disabled}
        onClick={() => onPress(sectionId, item.id)}
      >
        {item.actionLabel ?? 'Run'}
      </button>
    </div>
  );
};

const SelectRow = ({
  sectionId,
  item,
  onSelect,
}: {
  sectionId: string;
  item: Extract<ControlsItemSnapshot, { type: 'select' }>;
  onSelect: (sectionId: string, itemId: string, value: string) => void;
}) => {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-100">{item.title}</div>
        {item.description ? (
          <div className="mt-1 text-xs text-gray-400">{item.description}</div>
        ) : null}
      </div>
      <select
        className="min-w-[160px] rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-200 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        value={item.value}
        disabled={item.disabled}
        onChange={(event) => onSelect(sectionId, item.id, event.target.value)}
      >
        {item.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

const TextRow = ({
  item,
}: {
  item: Extract<ControlsItemSnapshot, { type: 'text' }>;
}) => {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-100">{item.title}</div>
        {item.description ? (
          <div className="mt-1 text-xs text-gray-400">{item.description}</div>
        ) : null}
      </div>
      <div className="max-w-[50%] rounded-md bg-gray-950/80 px-3 py-1.5 text-right text-xs text-gray-300">
        {item.value}
      </div>
    </div>
  );
};

const renderItem = ({
  sectionId,
  item,
  onToggle,
  onPress,
  onSelect,
}: {
  sectionId: string;
  item: ControlsItemSnapshot;
  onToggle: (sectionId: string, itemId: string, value: boolean) => void;
  onPress: (sectionId: string, itemId: string) => void;
  onSelect: (sectionId: string, itemId: string, value: string) => void;
}) => {
  if (item.type === 'text') {
    return <TextRow item={item} />;
  }

  if (item.type === 'toggle') {
    return <ToggleRow sectionId={sectionId} item={item} onToggle={onToggle} />;
  }

  if (item.type === 'select') {
    return <SelectRow sectionId={sectionId} item={item} onSelect={onSelect} />;
  }

  return <ButtonRow sectionId={sectionId} item={item} onPress={onPress} />;
};

export default function ControlsPanel() {
  const [sections, setSections] = useState<ControlsSectionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

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
      }
    );

    client.send('get-snapshot', {
      type: 'get-snapshot',
    });

    return () => {
      snapshotSubscription.remove();
    };
  }, [client]);

  const handleToggle = (sectionId: string, itemId: string, value: boolean) => {
    if (!client) {
      return;
    }

    client.send('invoke-action', {
      type: 'invoke-action',
      sectionId,
      itemId,
      action: 'toggle',
      value,
    });
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
    if (!client) {
      return;
    }

    client.send('invoke-action', {
      type: 'invoke-action',
      sectionId,
      itemId,
      action: 'select',
      value,
    });
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
                      onToggle: handleToggle,
                      onPress: handlePress,
                      onSelect: handleSelect,
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
