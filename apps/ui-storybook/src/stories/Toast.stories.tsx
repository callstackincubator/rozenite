import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Toast, useToast } from '@rozenite/ui';
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
export const Interactive: Story = {
  render: () => (
    <Toast.Provider>
      <ToastDemo />
    </Toast.Provider>
  ),
};
