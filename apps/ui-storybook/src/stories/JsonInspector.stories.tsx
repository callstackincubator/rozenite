import type { Meta, StoryObj } from '@storybook/react-vite';
import { JsonInspector } from '../../../../packages/ui/src/json-inspector/json-inspector';
const meta = {
  component: JsonInspector,
  title: 'Components/JsonInspector',
} satisfies Meta<typeof JsonInspector>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use to inspect nested object and array values without leaving the current view.
 * @summary Inspect nested structured data.
 */
export const NestedData: Story = {
  args: {
    data: {
      name: 'Rozenite',
      version: 2,
      enabled: true,
      features: ['inspector', 'network'],
    },
  },
};
