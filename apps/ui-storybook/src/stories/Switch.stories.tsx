import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from '@rozenite/ui';
const meta = { component: Switch, title: 'Components/Switch' } satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { 'aria-label': 'Enable notifications' } };
export const Checked: Story = { args: { 'aria-label': 'Enabled', defaultChecked: true } };
