import type { Meta, StoryObj } from '@storybook/react-vite';
import { IndicatorDot } from '@rozenite/ui';

const meta = {
  component: IndicatorDot,
  title: 'Components/IndicatorDot',
} satisfies Meta<typeof IndicatorDot>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Use to flag that something needs attention, e.g. an available update.
 * @summary Flag that something needs attention.
 */
export const Variants: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <IndicatorDot />
      <IndicatorDot variant="destructive" />
      <IndicatorDot className="size-2.5" />
    </div>
  ),
};
