import type { Meta, StoryObj } from '@storybook/react-vite';
import { Split } from '../../../../packages/ui/src/split/split';
const meta = { component: Split, title: 'Components/Split' } satisfies Meta<
  typeof Split
>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use when related panel content needs resizable panes.
 * @summary Resize related content panes.
 */
export const Horizontal: Story = {
  render: () => (
    <div className="h-64 w-[40rem] border border-border">
      <Split>
        <Split.Pane defaultSize={30} minSize={20} className="p-4">
          Sidebar
        </Split.Pane>
        <Split.Handle withHandle />
        <Split.Pane className="p-4">Content</Split.Pane>
      </Split>
    </div>
  ),
};
