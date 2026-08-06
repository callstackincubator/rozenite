import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, PluginHeader, PluginShell } from '@rozenite/ui';
const meta = { component: PluginHeader, title: 'Components/PluginHeader' } satisfies Meta<typeof PluginHeader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { render: () => <PluginShell className="w-[40rem]"><PluginHeader><PluginHeader.Title>Storage</PluginHeader.Title><PluginHeader.Subtitle>Manage persisted values</PluginHeader.Subtitle><PluginHeader.Actions><Button size="compact" variant="outline">Refresh</Button><PluginHeader.ThemeSwitcher /></PluginHeader.Actions></PluginHeader></PluginShell> };
