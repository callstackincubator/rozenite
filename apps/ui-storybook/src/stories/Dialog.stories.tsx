import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@rozenite/ui';
import { Dialog } from '../../../../packages/ui/src/dialog/dialog';
const meta = { component: Dialog, title: 'Components/Dialog' } satisfies Meta<
  typeof Dialog
>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use for focused tasks that temporarily interrupt the current view.
 * @summary Show a focused modal task.
 */
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
