import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@rozenite/ui';
const meta = { component: Badge, title: 'Components/Badge' } satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Compare badge emphases when categorizing content.
 * @summary Compare badge emphasis variants.
 */
export const Variants: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge>Default</Badge>
      <Badge tone="neutral">Secondary</Badge>
      <Badge tone="neutral" variant="outline">
        Outline
      </Badge>
    </div>
  ),
};

/** Badge now carries every tone from the shared `Tone` scale, including
 * `danger` — previously only reachable via hand-written `bg-red-500`.
 * @summary Compare badge tones.
 */
export const Tones: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge tone="neutral">Neutral</Badge>
      <Badge tone="primary">Primary</Badge>
      <Badge tone="success">Success</Badge>
      <Badge tone="warning">Warning</Badge>
      <Badge tone="danger">Danger</Badge>
      <Badge tone="info">Info</Badge>
    </div>
  ),
};
