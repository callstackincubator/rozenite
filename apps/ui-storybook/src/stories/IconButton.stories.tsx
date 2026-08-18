import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton, Settings, Trash2 } from '@rozenite/ui';

const meta = {
  component: IconButton,
  title: 'Components/IconButton',
  parameters: {
    docs: {
      description: {
        component:
          'A square, icon-only button. `label` is required and doubles as the accessible name and the tooltip.',
      },
    },
  },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * `label` is required, so an unlabelled icon button is a type error. It is
 * shown as the button's own tooltip on hover.
 * @summary Every icon button is labelled and shows its own tooltip.
 */
export const AllVariants: Story = {
  args: { label: 'Settings' },
  render: () => (
    <div className="flex items-center gap-2">
      <IconButton label="Settings">
        <Settings />
      </IconButton>
      <IconButton label="Delete" variant="destructive">
        <Trash2 />
      </IconButton>
      <IconButton label="Settings" size="sm">
        <Settings />
      </IconButton>
      <IconButton label="Settings" size="lg">
        <Settings />
      </IconButton>
    </div>
  ),
};
