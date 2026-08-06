import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScrollArea } from '@rozenite/ui';
const meta = {
  component: ScrollArea,
  title: 'Components/ScrollArea',
} satisfies Meta<typeof ScrollArea>;
export default meta;
type Story = StoryObj<typeof meta>;
export const LongContent: Story = {
  render: () => (
    <ScrollArea className="h-48 w-72 border border-border p-3">
      <div className="space-y-3">
        {Array.from({ length: 12 }, (_, index) => (
          <p key={index}>Scrollable item {index + 1}</p>
        ))}
      </div>
    </ScrollArea>
  ),
};
