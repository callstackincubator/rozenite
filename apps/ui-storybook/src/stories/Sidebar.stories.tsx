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
            adornment={<OverviewIcon />}
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
