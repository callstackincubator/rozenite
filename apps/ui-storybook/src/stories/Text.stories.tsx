import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text, Heading } from '@rozenite/ui';

const meta = {
  component: Text,
  title: 'Components/Text',
  parameters: {
    docs: {
      description: {
        component: 'Use Text for typography that is not a page or section heading.',
      },
    },
  },
} satisfies Meta<typeof Text>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Compare every type variant, plus `Heading` for semantic h1-h6 elements.
 * @summary Compare every typography variant.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Heading level={2}>Heading (h2)</Heading>
      <Text variant="title">Title</Text>
      <Text variant="heading">Heading</Text>
      <Text variant="body">Body</Text>
      <Text variant="caption">Caption</Text>
      <Text variant="code">const x = 1;</Text>
      <Text variant="numeric">1,024.50</Text>
    </div>
  ),
};
