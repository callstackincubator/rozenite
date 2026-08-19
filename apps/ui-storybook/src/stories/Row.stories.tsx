import type { Meta, StoryObj } from '@storybook/react-vite';
import { Row } from '@rozenite/ui';

const meta = {
  component: Row,
  title: 'Components/Row',
  parameters: {
    docs: {
      description: {
        component: 'A horizontal flex layout primitive with gap, alignment, wrap, fill and scroll.',
      },
    },
  },
} satisfies Meta<typeof Row>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Compare gap and alignment options for laying out items in a row.
 * @summary Compare gap and alignment options.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Row gap={2}>
        <div className="bg-primary/20 px-3 py-2 text-xs">A</div>
        <div className="bg-primary/20 px-3 py-2 text-xs">B</div>
        <div className="bg-primary/20 px-3 py-2 text-xs">C</div>
      </Row>
      <Row gap={4} justify="between" className="w-64">
        <div className="bg-primary/20 px-3 py-2 text-xs">Left</div>
        <div className="bg-primary/20 px-3 py-2 text-xs">Right</div>
      </Row>
    </div>
  ),
};

/**
 * `fill` + `scroll` encodes the `min-w-0 flex-1 overflow-auto` idiom for a
 * row that must not grow past its container.
 * @summary Constrain a row to its container and let it scroll.
 */
export const FillAndScroll: Story = {
  render: () => (
    <Row gap={2} scroll fill className="w-48 border border-border p-2">
      {Array.from({ length: 20 }, (_, i) => (
        <div key={i} className="shrink-0 bg-primary/20 px-3 py-2 text-xs">
          Item {i}
        </div>
      ))}
    </Row>
  ),
};
