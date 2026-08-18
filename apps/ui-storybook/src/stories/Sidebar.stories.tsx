import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@rozenite/ui';
import { Sidebar } from '@rozenite/ui';

function OverviewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

const meta = { component: Sidebar, title: 'Components/Sidebar' } satisfies Meta<typeof Sidebar>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use for persistent panel navigation with grouped items.
 * @summary Navigate grouped panel sections.
 */
export const Default: Story = {
  render: () => (
    <div className="h-72">
      <Sidebar>
        <Sidebar.Group label="Workspace">
          <Sidebar.Item
            selected
            leading={<OverviewIcon />}
            trailing={<Badge variant="secondary">3</Badge>}
          >
            Overview
          </Sidebar.Item>
          <Sidebar.Item>Network</Sidebar.Item>
          <Sidebar.Item>Storage</Sidebar.Item>
        </Sidebar.Group>
      </Sidebar>
    </div>
  ),
};

/** Use `Sidebar.Header` and `Sidebar.Footer` for the sticky, bordered chrome
 * around the scrollable item list.
 * @summary Frame the item list with a sticky header and footer.
 */
export const WithHeaderAndFooter: Story = {
  render: () => (
    <div className="h-72">
      <Sidebar className="gap-0 p-0">
        <Sidebar.Header>
          <span className="font-medium">Rozenite</span>
        </Sidebar.Header>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <Sidebar.Group label="Workspace">
            <Sidebar.Item selected leading={<OverviewIcon />}>
              Overview
            </Sidebar.Item>
            <Sidebar.Item>Network</Sidebar.Item>
          </Sidebar.Group>
        </div>
        <Sidebar.Footer>
          <span className="text-xs text-sidebar-foreground/60">v1.0.0</span>
        </Sidebar.Footer>
      </Sidebar>
    </div>
  ),
};
