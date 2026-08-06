import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchField } from '@rozenite/ui';
const meta = { component: SearchField, title: 'Components/SearchField' } satisfies Meta<typeof SearchField>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { placeholder: 'Search plugins…' } };
