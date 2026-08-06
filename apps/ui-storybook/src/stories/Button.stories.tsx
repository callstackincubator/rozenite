import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@rozenite/ui';

const meta = {
  component: Button,
  title: 'Components/Button',
  parameters: {
    docs: {
      description: {
        component: 'Use Button for actions that change state or submit work.',
      },
    },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Compare the available visual variants when choosing an action emphasis.
 * @summary Compare button action emphasis variants.
 */
export const AllVariants: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Compare the available visual variants when choosing an action emphasis.',
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};
