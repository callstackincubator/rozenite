import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchField } from '../../../../packages/ui/src/search-field/search-field';
const meta = {
  component: SearchField,
  title: 'Components/SearchField',
} satisfies Meta<typeof SearchField>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use for filtering a list or searching within the current panel.
 * @summary Search or filter panel content.
 */
export const Default: Story = { args: { placeholder: 'Search plugins…' } };
