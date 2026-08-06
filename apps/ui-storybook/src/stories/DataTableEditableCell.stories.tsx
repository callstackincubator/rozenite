import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataTableEditableCell } from '../../../../packages/ui/src/data-table/data-table-editable-cell';
const meta = {
  component: DataTableEditableCell,
  title: 'Components/DataTableEditableCell',
} satisfies Meta<typeof DataTableEditableCell>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use when a table value should remain compact until the user starts editing.
 * @summary Edit a table value on demand.
 */
export const ClickToEdit: Story = {
  args: { value: 'Click to edit', onCommit: () => undefined },
};
