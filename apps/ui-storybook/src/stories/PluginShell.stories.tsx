import type { Meta, StoryObj } from '@storybook/react-vite';
import { PluginHeader } from '@rozenite/ui';
import { PluginShell } from '@rozenite/ui';
const meta = {
  component: PluginShell,
  title: 'Components/PluginShell',
  parameters: { withPluginShell: false },
} satisfies Meta<typeof PluginShell>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use as the themed root for a plugin panel and its portal-based surfaces.
 * @summary Render a themed plugin panel shell.
 */
export const WithHeader: Story = {
  render: () => (
    <PluginShell className="h-96 w-[40rem]">
      <PluginHeader>
        <PluginHeader.Title>Network activity</PluginHeader.Title>
        <PluginHeader.Subtitle>Live requests</PluginHeader.Subtitle>
        <PluginHeader.Actions>
          <PluginHeader.ThemeSwitcher />
        </PluginHeader.Actions>
      </PluginHeader>
      <PluginShell.Body>
        <div className="p-4 text-sm">Panel content</div>
      </PluginShell.Body>
    </PluginShell>
  ),
};
