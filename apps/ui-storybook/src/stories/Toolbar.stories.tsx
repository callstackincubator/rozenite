import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toolbar } from '@rozenite/ui';
const meta = { component: Toolbar, title: 'Components/Toolbar' } satisfies Meta<typeof Toolbar>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use for a compact group of related actions.
 * @summary Group related actions.
 */
export const Default: Story = {
  render: () => (
    <Toolbar>
      <Toolbar.Group>
        <Toolbar.Button>Refresh</Toolbar.Button>
        <Toolbar.Button>Clear</Toolbar.Button>
      </Toolbar.Group>
      <Toolbar.Separator />
      <Toolbar.Button>Settings</Toolbar.Button>
    </Toolbar>
  ),
};
