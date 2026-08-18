import type { Meta, StoryObj } from '@storybook/react-vite';
import { Menu, Button } from '@rozenite/ui';

const meta = {
  component: Menu,
  title: 'Components/Menu',
  parameters: {
    docs: {
      description: {
        component: 'A dropdown menu of actions, opened from a trigger.',
      },
    },
  },
} satisfies Meta<typeof Menu>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Use for a set of actions that do not warrant their own toolbar buttons.
 * @summary Open a menu of actions from a trigger.
 */
export const Default: Story = {
  render: () => (
    <Menu>
      <Menu.Trigger
        render={
          <Button tone="neutral" variant="outline">
            Actions
          </Button>
        }
      />
      <Menu.Content>
        <Menu.Group>
          <Menu.GroupLabel>Panel</Menu.GroupLabel>
          <Menu.Item>Refresh</Menu.Item>
          <Menu.Item>Export</Menu.Item>
        </Menu.Group>
        <Menu.Separator />
        <Menu.Item>Clear all</Menu.Item>
      </Menu.Content>
    </Menu>
  ),
};
