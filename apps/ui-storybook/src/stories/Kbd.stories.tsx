import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from '@rozenite/ui';

const meta = {
  component: Kbd,
  title: 'Components/Kbd',
  parameters: {
    docs: {
      description: {
        component: 'A styled keyboard key or shortcut hint.',
      },
    },
  },
} satisfies Meta<typeof Kbd>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Use to document a keyboard shortcut inline with other text.
 * @summary Compose keys into a shortcut hint.
 */
export const Shortcut: Story = {
  render: () => (
    <div className="flex items-center gap-1 text-sm">
      <span>Save with</span>
      <Kbd>Ctrl</Kbd>
      <span>+</span>
      <Kbd>S</Kbd>
    </div>
  ),
};
