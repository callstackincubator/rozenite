import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataTable } from '@rozenite/ui';
type Row = { name: string; status: string };
const columns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'status', header: 'Status' },
];
const data: Row[] = [
  { name: 'React Native', status: 'Active' },
  { name: 'Vite', status: 'Ready' },
  { name: 'Storybook', status: 'In progress' },
];
const meta = {
  component: DataTable,
  title: 'Components/DataTable',
} satisfies Meta<typeof DataTable>;
export default meta;
type Story = StoryObj;
/** Use for sortable tabular data when the full dataset fits in the rendered table.
 * @summary Display sortable tabular data.
 */
export const Default: Story = {
  render: () => <DataTable<Row> columns={columns} data={data} />,
};

const resizableColumns = [
  { accessorKey: 'name', header: 'Name', size: 220 },
  { accessorKey: 'status', header: 'Status', size: 160 },
  { id: 'actions', header: 'Actions', size: 96, enableResizing: false, cell: () => '—' },
];

/** Use when columns hold values of very different lengths and people need to read them in full.
 * Drag a header's right edge, focus it and press the arrow keys, or double-click it to reset.
 * A column opts out with `enableResizing: false`; the table is as wide as its columns.
 * @summary Let people resize columns.
 */
export const ColumnResizing: Story = {
  render: () => (
    <DataTable<Row>
      ariaLabel="Resizable columns"
      columns={resizableColumns}
      data={data}
      columnResizing={{ minSize: 80, maxSize: 480 }}
    />
  ),
};
