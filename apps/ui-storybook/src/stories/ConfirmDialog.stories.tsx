import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, ConfirmDialog } from '@rozenite/ui';
const meta = { component: ConfirmDialog, title: 'Components/ConfirmDialog' } satisfies Meta<typeof ConfirmDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Open: Story = { render: () => <><Button>Trigger is represented by the open dialog</Button><ConfirmDialog open onOpenChange={() => undefined} title="Delete project?" description="This action cannot be undone." destructive /></> };
