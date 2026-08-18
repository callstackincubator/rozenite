import type { Meta, StoryObj } from '@storybook/react-vite';
import { NestedList, ScrollArea } from '@rozenite/ui';

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
        <NestedList.Item label="src" leading={<FolderIcon />} defaultExpanded>
          <NestedList.Item label="index.ts" leading={<FileIcon />} />
          <NestedList.Item label="components" leading={<FolderIcon />} defaultExpanded>
            <NestedList.Item label="Button.tsx" leading={<FileIcon />} selected />
            <NestedList.Item label="List.tsx" leading={<FileIcon />} />
          </NestedList.Item>
        </NestedList.Item>
        <NestedList.Item label="package.json" leading={<FileIcon />} />
      </NestedList>
    </div>
  ),
};

/** Rows keep their natural width instead of truncating, so a narrow, deeply nested tree
 * overflows horizontally — wrap it in `ScrollArea` to make that overflow scrollable.
 * @summary Scroll horizontally through deeply nested, long labels.
 */
export const DeepNestingWithHorizontalScroll: Story = {
  render: () => (
    <ScrollArea className="h-72 w-64 border border-border">
      <div className="p-2">
        <NestedList>
          <NestedList.Item label="src" leading={<FolderIcon />} defaultExpanded>
            <NestedList.Item label="components" leading={<FolderIcon />} defaultExpanded>
              <NestedList.Item label="storage-adapters" leading={<FolderIcon />} defaultExpanded>
                <NestedList.Item
                  label="async-storage-adapter-implementation.ts"
                  leading={<FileIcon />}
                  selected
                />
              </NestedList.Item>
            </NestedList.Item>
          </NestedList.Item>
        </NestedList>
      </div>
    </ScrollArea>
  ),
};
