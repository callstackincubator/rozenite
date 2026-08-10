import type { Meta, StoryObj } from '@storybook/react-vite';
import { Separator } from '@rozenite/ui';

const meta = {
  component: Separator,
  title: 'Components/Separator',
} satisfies Meta<typeof Separator>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Use to divide related content or actions.
 * @summary Divide content horizontally or vertically.
 */
export const Orientations: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-sm">Above</div>
        <Separator className="my-2" />
        <div className="text-sm">Below</div>
      </div>
      <div className="flex h-6 items-center gap-2 text-sm">
        <span>Left</span>
        <Separator orientation="vertical" />
        <span>Right</span>
      </div>
    </div>
  ),
};
