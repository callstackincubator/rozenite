import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ColumnDef } from '@tanstack/react-table';
import { VirtualizedDataTable } from '@rozenite/ui';
type Row = { id: string; name: string; status: string };
const data: Row[] = Array.from({ length: 30 }, (_, index) => ({
  id: String(index),
  name: `Request ${index + 1}`,
  status: index % 2 ? '200 OK' : 'Pending',
}));
const columns: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'status', header: 'Status' },
];
const meta = {
  component: VirtualizedDataTable,
  title: 'Components/VirtualizedDataTable',
} satisfies Meta<typeof VirtualizedDataTable>;
export default meta;
type Story = StoryObj;
/** Use for large tabular datasets that need bounded rendering.
 * @summary Render a large dataset efficiently.
 */
export const Default: Story = {
  render: () => (
    <VirtualizedDataTable<Row>
      ariaLabel="Requests"
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      getRowTextValue={(row) => row.name}
      style={{ height: 320 }}
    />
  ),
};
