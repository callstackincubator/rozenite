import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from '@rozenite/ui';
const meta = { component: Select, title: 'Components/Select' } satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use when the available options are known and should be chosen from a menu.
 * @summary Choose from known options.
 */
export const Default: Story = {
  render: () => (
    <Select defaultValue="light">
      <Select.Trigger>
        <Select.Value placeholder="Choose a theme" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="light">Light</Select.Item>
        <Select.Item value="dark">Dark</Select.Item>
        <Select.Item value="system">System</Select.Item>
      </Select.Content>
    </Select>
  ),
};
