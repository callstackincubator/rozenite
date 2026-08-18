import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@rozenite/ui';
import { ConfirmDialog } from '@rozenite/ui';
const meta = {
  component: ConfirmDialog,
  title: 'Components/ConfirmDialog',
} satisfies Meta<typeof ConfirmDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use before destructive actions when the user must explicitly confirm.
 * @summary Confirm a destructive action.
 */
export const Open: Story = {
  args: { open: true, onOpenChange: () => undefined, title: 'Delete project?' },
  render: (args) => (
    <>
      <Button>Trigger is represented by the open dialog</Button>
      <ConfirmDialog {...args} description="This action cannot be undone." tone="danger" />
    </>
  ),
};
