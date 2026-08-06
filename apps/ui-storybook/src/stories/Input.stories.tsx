import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '@rozenite/ui';
const meta = { component: Input, title: 'Components/Input' } satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use for short, single-line text values.
 * @summary Enter a short text value.
 */
export const Default: Story = { args: { placeholder: 'Type something…' } };
