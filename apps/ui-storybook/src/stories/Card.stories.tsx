import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, Card, DescriptionList } from '@rozenite/ui';

const meta = {
  component: Card,
  title: 'Components/Card',
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Use to group related content behind a bordered container.
 * @summary Group related content.
 */
export const Default: Story = {
  render: () => (
    <Card className="w-96">
      <Card.Header>
        <span className="font-medium">@rozenite/network-activity-plugin</span>
        <Badge>1.2.0</Badge>
      </Card.Header>
      <Card.Body>
        <DescriptionList>
          <DescriptionList.Item label="Panels">Network</DescriptionList.Item>
        </DescriptionList>
      </Card.Body>
    </Card>
  ),
};

/** Use `collapsible` when the body content is secondary detail.
 * @summary Collapse body content behind a toggle.
 */
export const Collapsible: Story = {
  render: () => (
    <Card className="w-96" collapsible>
      <Card.Header>
        <span className="font-medium">@rozenite/storage-plugin</span>
        <Badge>2.0.1</Badge>
      </Card.Header>
      <Card.Body>
        <DescriptionList>
          <DescriptionList.Item label="Panels">Storage</DescriptionList.Item>
        </DescriptionList>
      </Card.Body>
    </Card>
  ),
};
