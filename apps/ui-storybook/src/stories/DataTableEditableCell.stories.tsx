import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataTableEditableCell } from '@rozenite/ui';
const meta = {
  component: DataTableEditableCell,
  title: 'Components/DataTableEditableCell',
} satisfies Meta<typeof DataTableEditableCell>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ClickToEdit: Story = {
  args: { value: 'Click to edit', onCommit: () => undefined },
};
