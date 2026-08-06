import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@rozenite/ui';
import { EmptyState } from '@rozenite/ui';
const meta = {
  component: EmptyState,
  title: 'Components/EmptyState',
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use when a view has no results and needs to guide the next action.
 * @summary Guide the next action from an empty view.
 */
export const Default: Story = {
  args: { title: 'No results found' },
  render: (args) => (
    <div className="h-64 w-[28rem]">
      <EmptyState
        {...args}
        description="Try changing your filters or search terms."
        action={<Button>Clear filters</Button>}
      />
    </div>
  ),
};
