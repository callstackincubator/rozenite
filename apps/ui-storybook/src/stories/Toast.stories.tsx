import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, useToast } from '@rozenite/ui';
import { Toast } from '../../../../packages/ui/src/toast/toast';
function ToastDemo() {
  const toast = useToast();
  return (
    <Button
      onClick={() =>
        toast.add({ title: 'Saved', description: 'Your changes were saved.' })
      }
    >
      Show toast
    </Button>
  );
}
const meta = {
  component: Toast.Provider,
  title: 'Components/Toast',
} satisfies Meta<typeof Toast.Provider>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use for transient feedback after a non-blocking action completes.
 * @summary Show transient action feedback.
 */
export const Interactive: Story = {
  render: () => (
    <Toast.Provider>
      <ToastDemo />
    </Toast.Provider>
  ),
};
