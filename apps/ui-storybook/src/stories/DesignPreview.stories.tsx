import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Badge,
  Button,
  DataTable,
  DescriptionList,
  EmptyState,
  Icon,
  IconButton,
  IndicatorDot,
  PluginHeader,
  PluginShell,
  RefreshCw,
  Search,
  Select,
  SearchField,
  Separator,
  Sidebar,
  Split,
  Switch,
  Tabs,
  Text,
  Toolbar,
  Trash2,
  Copy,
  type DataTableColumn,
} from '@rozenite/ui';

/** The Rozenite mark on its 7×10 step grid (docs/DESIGN.md, "The mark"). */
const MARK = [
  '...#...',
  '..###..',
  '..###..',
  '.#####.',
  '.#####.',
  '#######',
  '#######',
  '#######',
  '.#####.',
  '..###..',
];

function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 7 10"
      className={className}
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden
    >
      {MARK.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null,
        ),
      )}
    </svg>
  );
}

type Request = {
  id: string;
  method: string;
  path: string;
  status: number;
  type: 'fetch' | 'xhr' | 'ws' | 'img';
  size: string;
  time: string;
};

const requests: Request[] = [
  {
    id: '1',
    method: 'GET',
    path: '/api/products',
    status: 200,
    type: 'fetch',
    size: '18.2 kB',
    time: '142 ms',
  },
  {
    id: '2',
    method: 'GET',
    path: '/api/user',
    status: 200,
    type: 'fetch',
    size: '1.1 kB',
    time: '88 ms',
  },
  {
    id: '3',
    method: 'POST',
    path: '/api/session',
    status: 201,
    type: 'xhr',
    size: '0.4 kB',
    time: '96 ms',
  },
  {
    id: '4',
    method: 'GET',
    path: '/images/runner-low.png',
    status: 200,
    type: 'img',
    size: '64.0 kB',
    time: '231 ms',
  },
  {
    id: '5',
    method: 'GET',
    path: 'wss://api.store.dev/live',
    status: 101,
    type: 'ws',
    size: '—',
    time: 'open',
  },
  {
    id: '6',
    method: 'GET',
    path: '/api/recommendations',
    status: 304,
    type: 'fetch',
    size: '0.2 kB',
    time: '41 ms',
  },
  {
    id: '7',
    method: 'GET',
    path: '/api/cart',
    status: 500,
    type: 'fetch',
    size: '0.3 kB',
    time: '212 ms',
  },
  {
    id: '8',
    method: 'PUT',
    path: '/api/cart/items',
    status: 200,
    type: 'fetch',
    size: '0.6 kB',
    time: '119 ms',
  },
];

const columns: DataTableColumn<Request>[] = [
  {
    accessorKey: 'method',
    header: 'Method',
    cell: ({ getValue }) => <Text variant="code">{getValue<string>()}</Text>,
  },
  {
    accessorKey: 'path',
    header: 'Request',
    cell: ({ getValue }) => <Text variant="code">{getValue<string>()}</Text>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => {
      const status = getValue<number>();
      return (
        <span className="inline-flex items-center gap-2">
          <Text variant="numeric">{status}</Text>
          {status >= 500 && (
            <Badge tone="danger" variant="soft" size="sm">
              Err
            </Badge>
          )}
        </span>
      );
    },
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ getValue }) => (
      <Badge tone="neutral" variant="soft" size="sm">
        {getValue<string>()}
      </Badge>
    ),
  },
  {
    accessorKey: 'size',
    header: 'Size',
    cell: ({ getValue }) => <Text variant="numeric">{getValue<string>()}</Text>,
  },
  {
    accessorKey: 'time',
    header: 'Time',
    cell: ({ getValue }) => <Text variant="numeric">{getValue<string>()}</Text>,
  },
];

const plugins = [
  'Expo Atlas',
  'Feature Flags',
  'File System',
  'Network Activity',
  'Overlay',
  'Performance Monitor',
  'React Navigation',
  'Redux DevTools',
  'Require Profiler',
  'SQLite',
  'Storage',
  'TanStack Query',
];

function RozeniteSidebar() {
  return (
    <Sidebar className="w-56">
      <Sidebar.Header className="gap-2 px-3">
        <Mark className="h-5 w-[14px] text-primary" />
        <Text variant="heading">Rozenite</Text>
      </Sidebar.Header>
      <Sidebar.Group label="Plugins">
        {plugins.map((name) => (
          <Sidebar.Item
            key={name}
            selected={name === 'Network Activity'}
            trailing={
              name === 'Network Activity' ? (
                <Badge tone="neutral" variant="soft" size="sm">
                  8
                </Badge>
              ) : name === 'TanStack Query' ? (
                <IndicatorDot tone="primary" />
              ) : undefined
            }
          >
            {name}
          </Sidebar.Item>
        ))}
      </Sidebar.Group>
    </Sidebar>
  );
}

function PanelHeader() {
  return (
    <PluginHeader>
      <div className="flex flex-col gap-0.5">
        <PluginHeader.Title>Network Activity</PluginHeader.Title>
        <PluginHeader.Subtitle>
          HTTP and WebSocket traffic from the running app.
        </PluginHeader.Subtitle>
      </div>
      <PluginHeader.Actions>
        <Badge tone="primary" variant="soft">
          <span className="inline-flex items-center gap-1.5">
            <IndicatorDot tone="primary" /> Recording
          </span>
        </Badge>
        <Separator orientation="vertical" />
        <IconButton label="Copy as cURL" tone="neutral" variant="ghost" size="sm">
          <Icon icon={Copy} />
        </IconButton>
        <Button tone="neutral" variant="outline" size="sm">
          Export HAR
        </Button>
        <Button tone="primary" size="sm">
          Stop recording
        </Button>
        <PluginHeader.ThemeSwitcher />
      </PluginHeader.Actions>
    </PluginHeader>
  );
}

function FilterBar({ count }: { count: number }) {
  return (
    <Toolbar>
      <div className="w-64">
        <SearchField size="sm" placeholder="Filter by URL" defaultValue="" />
      </div>
      <Toolbar.Separator />
      <Tabs defaultValue="all">
        <Tabs.List size="sm">
          <Tabs.Tab size="sm" value="all">
            All
          </Tabs.Tab>
          <Tabs.Tab size="sm" value="fetch">
            Fetch
          </Tabs.Tab>
          <Tabs.Tab size="sm" value="xhr">
            XHR
          </Tabs.Tab>
          <Tabs.Tab size="sm" value="ws">
            WS
          </Tabs.Tab>
          <Tabs.Tab size="sm" value="img">
            Img
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <Toolbar.Separator />
      <div className="w-36">
        <Select defaultValue="any" items={{ any: 'Any method', GET: 'GET', POST: 'POST' }}>
          <Select.Trigger size="sm">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="any">Any method</Select.Item>
            <Select.Item value="GET">GET</Select.Item>
            <Select.Item value="POST">POST</Select.Item>
          </Select.Content>
        </Select>
      </div>
      <label className="ml-2 flex items-center gap-2">
        <Switch defaultChecked />
        <Text variant="caption">Preserve log</Text>
      </label>
      <div className="flex-1" />
      <Text variant="label">
        {count} requests · {count ? '85.8 kB' : '0 B'}
      </Text>
      <Toolbar.Button>
        <Icon icon={RefreshCw} />
        Reload
      </Toolbar.Button>
      <Toolbar.Button>
        <Icon icon={Trash2} />
        Clear
      </Toolbar.Button>
    </Toolbar>
  );
}

function DetailPane() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Text variant="code">GET</Text>
        <Text variant="code" className="flex-1 truncate">
          /api/cart
        </Text>
        <Badge tone="danger" variant="soft" size="sm">
          500 Err
        </Badge>
      </div>
      <Tabs defaultValue="headers" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border px-2 py-1.5">
          <Tabs.List size="sm">
            <Tabs.Tab size="sm" value="headers">
              Headers
            </Tabs.Tab>
            <Tabs.Tab size="sm" value="payload">
              Payload
            </Tabs.Tab>
            <Tabs.Tab size="sm" value="response">
              Response
            </Tabs.Tab>
            <Tabs.Tab size="sm" value="timing">
              Timing
            </Tabs.Tab>
          </Tabs.List>
        </div>
        <Tabs.Panel value="headers" className="overflow-auto p-4">
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-2">
              <Text variant="label">General</Text>
              <DescriptionList>
                <DescriptionList.Item label="Request URL">
                  <Text variant="code">https://api.store.dev/api/cart</Text>
                </DescriptionList.Item>
                <DescriptionList.Item label="Method">
                  <Text variant="code">GET</Text>
                </DescriptionList.Item>
                <DescriptionList.Item label="Status">
                  <Text variant="numeric">500 Internal Server Error</Text>
                </DescriptionList.Item>
                <DescriptionList.Item label="Duration">
                  <Text variant="numeric">212 ms</Text>
                </DescriptionList.Item>
              </DescriptionList>
            </section>
            <section className="flex flex-col gap-2">
              <Text variant="label">Response headers</Text>
              <DescriptionList>
                <DescriptionList.Item label="content-type">
                  <Text variant="code">application/json</Text>
                </DescriptionList.Item>
                <DescriptionList.Item label="x-request-id">
                  <Text variant="code">7f3a2c19-d0e4</Text>
                </DescriptionList.Item>
                <DescriptionList.Item label="cache-control">
                  <Text variant="code">no-store</Text>
                </DescriptionList.Item>
              </DescriptionList>
            </section>
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

function Panel({ empty = false }: { empty?: boolean }) {
  return (
    <PluginShell className="h-[760px] w-full">
      <div className="flex min-h-0 flex-1">
        <RozeniteSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <PanelHeader />
          <FilterBar count={empty ? 0 : requests.length} />
          <PluginShell.Body>
            {empty ? (
              <EmptyState
                icon={Search}
                title="No requests yet"
                description="Requests show up here as the app makes them. Reload the app to capture its startup traffic."
                action={
                  <Button tone="neutral" variant="outline" size="sm">
                    Reload app
                  </Button>
                }
              />
            ) : (
              <Split direction="horizontal">
                <Split.Pane defaultSize={58} minSize={30}>
                  <div className="h-full overflow-auto">
                    <DataTable
                      ariaLabel="Requests"
                      columns={columns}
                      data={requests}
                      onRowClick={() => undefined}
                    />
                  </div>
                </Split.Pane>
                <Split.Handle />
                <Split.Pane defaultSize={42} minSize={25}>
                  <DetailPane />
                </Split.Pane>
              </Split>
            )}
          </PluginShell.Body>
        </div>
      </div>
    </PluginShell>
  );
}

function withTheme(theme: 'dark' | 'light') {
  return () => {
    localStorage.setItem('@rozenite/ui:theme', theme);
  };
}

const meta = {
  title: 'Preview/Design refresh',
  parameters: { withPluginShell: false, layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A Network Activity-style panel composed from the most-used components, dark theme. */
export const Dark: Story = {
  beforeEach: withTheme('dark'),
  render: () => <Panel />,
};

/** The same panel in the light theme. */
export const Light: Story = {
  beforeEach: withTheme('light'),
  render: () => <Panel />,
};

/** The panel before any traffic arrives. */
export const Empty: Story = {
  beforeEach: withTheme('dark'),
  render: () => <Panel empty />,
};
