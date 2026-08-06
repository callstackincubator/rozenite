import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Dialog } from '@rozenite/ui';
const meta = { component: Dialog, title: 'Components/Dialog' } satisfies Meta<
  typeof Dialog
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Dialog>
      <Dialog.Trigger render={<Button>Open dialog</Button>} />
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Project settings</Dialog.Title>
          <Dialog.Description>
            Manage your project configuration.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="outline" />}>
            Cancel
          </Dialog.Close>
          <Button>Save changes</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  ),
};
