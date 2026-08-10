import type { Meta, StoryObj } from '@storybook/react-vite';
import { DescriptionList } from '@rozenite/ui';

const meta = {
  component: DescriptionList,
  title: 'Components/DescriptionList',
} satisfies Meta<typeof DescriptionList>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Use for a list of label/value rows describing an entity.
 * @summary Describe an entity with label/value rows.
 */
export const Default: Story = {
  render: () => (
    <DescriptionList className="w-80">
      <DescriptionList.Item label="Panels">Network, Storage</DescriptionList.Item>
      <DescriptionList.Item label="Description">Inspect network traffic.</DescriptionList.Item>
    </DescriptionList>
  ),
};
