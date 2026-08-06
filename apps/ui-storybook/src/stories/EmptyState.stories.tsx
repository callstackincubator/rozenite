import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, EmptyState } from '@rozenite/ui';
const meta = { component: EmptyState, title: 'Components/EmptyState' } satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { render: () => <div className="h-64 w-[28rem]"><EmptyState title="No results found" description="Try changing your filters or search terms." action={<Button>Clear filters</Button>} /></div> };
