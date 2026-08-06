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
export const Default: Story = {
  args: { columns, data },
  render: (args) => <DataTable<Row> {...args} />,
};
