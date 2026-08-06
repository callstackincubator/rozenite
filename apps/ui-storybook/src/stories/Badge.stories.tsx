import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@rozenite/ui';
const meta = { component: Badge, title: 'Components/Badge' } satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Compare badge treatments when categorizing content.
 * @summary Compare badge variants.
 */
export const Variants: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};
