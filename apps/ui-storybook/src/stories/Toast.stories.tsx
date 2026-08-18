import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, useToast } from '@rozenite/ui';
import { Toast } from '@rozenite/ui';
function ToastDemo() {
  const toast = useToast();
  return (
    <Button onClick={() => toast.add({ title: 'Saved', description: 'Your changes were saved.' })}>
      Show toast
    </Button>
  );
}
const meta = {
  component: Toast,
  title: 'Components/Toast',
} satisfies Meta<typeof Toast>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use for transient feedback after a non-blocking action completes.
 * `Toast` itself is callable — `Toast.Provider` is a deprecated alias.
 * @summary Show transient action feedback.
 */
export const Interactive: Story = {
  render: () => (
    <Toast>
      <ToastDemo />
    </Toast>
  ),
};
