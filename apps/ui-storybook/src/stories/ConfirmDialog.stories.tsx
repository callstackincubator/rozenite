import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button, useConfirmDialog } from '@rozenite/ui';
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

function ImperativeDemo() {
  const confirm = useConfirmDialog();
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        tone="danger"
        onClick={async () => {
          const confirmed = await confirm({
            title: 'Delete project?',
            description: 'This action cannot be undone.',
            tone: 'danger',
            confirmLabel: 'Delete',
          });
          setResult(confirmed ? 'Confirmed' : 'Cancelled');
        }}
      >
        Delete project
      </Button>
      {result && <span className="text-sm text-muted-foreground">{result}</span>}
    </div>
  );
}
/** `useConfirmDialog()` resolves a promise with the user's choice instead of
 * driving `open` from local state — `PluginShell` mounts `ConfirmDialog.Provider`
 * automatically, so plugin panels only need the hook.
 * @summary Confirm imperatively with `useConfirmDialog()`.
 */
export const Imperative: Story = {
  args: { open: false, onOpenChange: () => undefined, title: 'Delete project?' },
  render: () => (
    <ConfirmDialog.Provider>
      <ImperativeDemo />
    </ConfirmDialog.Provider>
  ),
};
