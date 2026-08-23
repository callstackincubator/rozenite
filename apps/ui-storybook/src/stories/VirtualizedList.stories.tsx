import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef, useState } from 'react';
import { Badge, VirtualizedList } from '@rozenite/ui';

type Level = 'info' | 'warn' | 'error';
type LogEntry = { id: string; level: Level; message: string };

const levelTone = {
  info: 'info',
  warn: 'warning',
  error: 'danger',
} as const satisfies Record<Level, 'info' | 'warning' | 'danger'>;

const lorem =
  'Connection established, negotiating protocol version and exchanging capability flags with the remote peer before the handshake finishes and the session becomes ready for traffic.';

const data: LogEntry[] = Array.from({ length: 200 }, (_, index) => {
  const level: Level = index % 9 === 0 ? 'error' : index % 3 === 0 ? 'warn' : 'info';
  const wordCount = 3 + ((index * 7) % 30);

  return {
    id: `log-${index}`,
    level,
    message: `Event ${index}: ${lorem.split(' ').slice(0, wordCount).join(' ')}`,
  };
});

const renderLogItem = (entry: LogEntry) => (
  <div className="flex items-start gap-2 px-3 py-2">
    <Badge tone={levelTone[entry.level]}>{entry.level}</Badge>
    <span className="text-sm text-foreground">{entry.message}</span>
  </div>
);

const meta = {
  component: VirtualizedList,
  title: 'Components/VirtualizedList',
} satisfies Meta<typeof VirtualizedList>;
export default meta;
type Story = StoryObj;

/** Use for large streams of variable-height rows, such as a log panel — a
 * message plus badges, one entry per row, with no manual measurement.
 * @summary Render a large stream of variable-height rows.
 */
export const Default: Story = {
  render: () => (
    <VirtualizedList<LogEntry>
      ariaLabel="Log entries"
      data={data}
      getItemKey={(item) => item.id}
      getItemTextValue={(item) => item.message}
      renderItem={renderLogItem}
      style={{ height: 320 }}
    />
  ),
};

function ClickableDemo() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <VirtualizedList<LogEntry>
        ariaLabel="Log entries"
        data={data.slice(0, 30)}
        getItemKey={(item) => item.id}
        getItemTextValue={(item) => item.message}
        onItemClick={(item) => setSelected(item.message)}
        renderItem={renderLogItem}
        style={{ height: 320 }}
      />
      {selected && <span className="text-sm text-muted-foreground">Selected: {selected}</span>}
    </div>
  );
}

/** Rows can be made actionable, for example to open a details drawer.
 * @summary Handle clicks on individual rows.
 */
export const Clickable: Story = {
  render: () => <ClickableDemo />,
};

/** Shown when the data set is empty and nothing is loading.
 * @summary Render the empty state.
 */
export const Empty: Story = {
  render: () => (
    <VirtualizedList<LogEntry>
      ariaLabel="Log entries"
      data={[]}
      emptyMessage="No log entries yet."
      renderItem={renderLogItem}
      style={{ height: 200 }}
    />
  ),
};

/** Shown while the first page of data is being fetched.
 * @summary Render the loading state.
 */
export const Loading: Story = {
  render: () => (
    <VirtualizedList<LogEntry>
      ariaLabel="Log entries"
      data={[]}
      loading
      renderItem={renderLogItem}
      style={{ height: 200 }}
    />
  ),
};

function LiveTailDemo() {
  const [entries, setEntries] = useState<LogEntry[]>(() => data.slice(0, 8));
  const nextIndexRef = useRef(8);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = data[nextIndexRef.current % data.length];

      nextIndexRef.current += 1;
      setEntries((current) => [...current, next]);
    }, 700);

    return () => clearInterval(interval);
  }, []);

  return (
    <VirtualizedList<LogEntry>
      ariaLabel="Live log tail"
      data={entries}
      followOutput="smooth"
      getItemKey={(item, index) => `${item.id}-${index}`}
      getItemTextValue={(item) => item.message}
      renderItem={renderLogItem}
      style={{ height: 320 }}
    />
  );
}

/** `followOutput` pins the view to the newest row while entries stream in
 * every 700ms, and releases as soon as the user scrolls away — the affordance
 * a live log tail needs.
 * @summary Pin the view to the newest row as it streams in.
 */
export const LiveTail: Story = {
  render: () => <LiveTailDemo />,
};
