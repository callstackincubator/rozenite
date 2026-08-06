import type { Meta, StoryObj } from '@storybook/react-vite';
import { PluginHeader, PluginShell } from '@rozenite/ui';
const meta = { component: PluginShell, title: 'Components/PluginShell' } satisfies Meta<typeof PluginShell>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WithHeader: Story = { render: () => <PluginShell className="h-96 w-[40rem]"><PluginHeader><PluginHeader.Title>Network activity</PluginHeader.Title><PluginHeader.Subtitle>Live requests</PluginHeader.Subtitle><PluginHeader.Actions><PluginHeader.ThemeSwitcher /></PluginHeader.Actions></PluginHeader><PluginShell.Body><div className="p-4 text-sm">Panel content</div></PluginShell.Body></PluginShell> };
