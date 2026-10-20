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

const resizableColumns: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Name', size: 240 },
  { accessorKey: 'status', header: 'Status', size: 160 },
  { id: 'actions', header: 'Actions', size: 96, enableResizing: false, cell: () => '—' },
];

/** Use when a large table has columns whose values are longer than their default width.
 * Drag a header's right edge, focus it and press the arrow keys, or double-click it to reset.
 * Long values truncate at the column width.
 * @summary Let people resize columns.
 */
export const ColumnResizing: Story = {
  render: () => (
    <VirtualizedDataTable<Row>
      ariaLabel="Resizable requests"
      columns={resizableColumns}
      columnResizing={{ minSize: 80, maxSize: 480 }}
      data={data}
      getRowId={(row) => row.id}
      getRowTextValue={(row) => row.name}
      style={{ height: 320 }}
    />
  ),
};

/** Use for a resizable table with no rows yet, such as a query that returned nothing.
 * The empty message spans the full width of the table, not just the width of its columns.
 * @summary Show an empty state in a resizable table.
 */
export const ColumnResizingEmpty: Story = {
  render: () => (
    <VirtualizedDataTable<Row>
      ariaLabel="Resizable requests with no rows"
      columns={resizableColumns}
      columnResizing={{ minSize: 80, maxSize: 480 }}
      data={[]}
      emptyMessage="No requests yet."
      getRowId={(row) => row.id}
      getRowTextValue={(row) => row.name}
      style={{ height: 320 }}
    />
  ),
};
