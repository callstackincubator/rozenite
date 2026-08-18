import type { Meta, StoryObj } from '@storybook/react-vite';
import { Column } from '@rozenite/ui';

const meta = {
  component: Column,
  title: 'Components/Column',
  parameters: {
    docs: {
      description: {
        component: 'A vertical flex layout primitive with gap, alignment, wrap, fill and scroll.',
      },
    },
  },
} satisfies Meta<typeof Column>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Compare gap and alignment options for stacking items in a column.
 * @summary Compare gap and alignment options.
 */
export const AllVariants: Story = {
  render: () => (
    <Column gap={2} className="w-48">
      <div className="bg-primary/20 px-3 py-2 text-xs">A</div>
      <div className="bg-primary/20 px-3 py-2 text-xs">B</div>
      <div className="bg-primary/20 px-3 py-2 text-xs">C</div>
    </Column>
  ),
};

/**
 * `fill` + `scroll` encodes the `min-h-0 flex-1 overflow-auto` idiom for a
 * scrollable column that must not grow past its container — the pattern
 * currently re-derived at 14 sites across 9 packages.
 * @summary Constrain a column to its container and let it scroll.
 */
export const FillAndScroll: Story = {
  render: () => (
    <Column gap={1} scroll fill className="h-40 w-48 border border-border p-2">
      {Array.from({ length: 20 }, (_, i) => (
        <div key={i} className="shrink-0 bg-primary/20 px-3 py-2 text-xs">
          Item {i}
        </div>
      ))}
    </Column>
  ),
};
