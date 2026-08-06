import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from '@rozenite/ui';
const meta = {
  component: Textarea,
  title: 'Components/Textarea',
} satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  args: { placeholder: 'Write a note…', rows: 4 },
};
