import type { Meta, StoryObj } from '@storybook/react-vite';
import { NestedList } from '@rozenite/ui';

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

const meta = {
  component: NestedList,
  title: 'Components/NestedList',
} satisfies Meta<typeof NestedList>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use for a collapsible tree nested to an arbitrary depth, such as a file or key browser.
 * @summary Browse a collapsible, indefinitely nested tree.
 */
export const Default: Story = {
  render: () => (
    <div className="h-72 w-64 border border-border p-2">
      <NestedList>
        <NestedList.Item label="src" adornment={<FolderIcon />} defaultExpanded>
          <NestedList.Item label="index.ts" adornment={<FileIcon />} />
          <NestedList.Item label="components" adornment={<FolderIcon />} defaultExpanded>
            <NestedList.Item label="Button.tsx" adornment={<FileIcon />} selected />
            <NestedList.Item label="List.tsx" adornment={<FileIcon />} />
          </NestedList.Item>
        </NestedList.Item>
        <NestedList.Item label="package.json" adornment={<FileIcon />} />
      </NestedList>
    </div>
  ),
};
