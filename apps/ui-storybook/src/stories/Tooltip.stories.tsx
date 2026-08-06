import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Tooltip } from '@rozenite/ui';
const meta = { component: Tooltip, title: 'Components/Tooltip' } satisfies Meta<typeof Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { render: () => <Tooltip.Provider><Tooltip><Tooltip.Trigger render={<Button variant="outline">Hover me</Button>} /><Tooltip.Content>Helpful context appears here.</Tooltip.Content></Tooltip></Tooltip.Provider> };
