import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@rozenite/ui';
import { Sidebar } from '@rozenite/ui';
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
          <Sidebar.Item selected trailing={<Badge variant="secondary">3</Badge>}>
            Overview
          </Sidebar.Item>
          <Sidebar.Item>Network</Sidebar.Item>
          <Sidebar.Item>Storage</Sidebar.Item>
        </Sidebar.Group>
      </Sidebar>
    </div>
  ),
};
