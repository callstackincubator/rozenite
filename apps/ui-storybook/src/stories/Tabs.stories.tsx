import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tabs } from '@rozenite/ui';
const meta = { component: Tabs, title: 'Components/Tabs' } satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { render: () => <Tabs defaultValue="overview" className="w-96"><Tabs.List><Tabs.Tab value="overview">Overview</Tabs.Tab><Tabs.Tab value="activity">Activity</Tabs.Tab></Tabs.List><Tabs.Panel value="overview" className="p-4 text-sm">Overview content</Tabs.Panel><Tabs.Panel value="activity" className="p-4 text-sm">Activity content</Tabs.Panel></Tabs> };
