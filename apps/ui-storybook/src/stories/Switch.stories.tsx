import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from '@rozenite/ui';
const meta = { component: Switch, title: 'Components/Switch' } satisfies Meta<
  typeof Switch
>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use for an immediate binary preference toggle.
 * @summary Toggle a binary preference.
 */
export const Default: Story = {
  args: { 'aria-label': 'Enable notifications' },
};
/** Use to show the enabled state of a binary preference.
 * @summary Show an enabled toggle.
 */
export const Checked: Story = {
  args: { 'aria-label': 'Enabled', defaultChecked: true },
};
