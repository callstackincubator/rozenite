import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToggleGroup, Info, AlertTriangle, XCircle } from '@rozenite/ui';
const meta = {
  component: ToggleGroup,
  title: 'Components/ToggleGroup',
} satisfies Meta<typeof ToggleGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Use for a single-select segmented control, e.g. switching between related views.
 * @summary Switch between mutually exclusive views.
 */
export const Default: Story = {
  render: () => (
    <ToggleGroup defaultValue={['list']}>
      <ToggleGroup.Item value="list">List</ToggleGroup.Item>
      <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
      <ToggleGroup.Item value="table">Table</ToggleGroup.Item>
    </ToggleGroup>
  ),
};

/** Use `multiple` to model several independent on/off facets in one control,
 * such as log level filters where several levels can be pressed at once.
 * @summary Toggle several independent facets at once.
 */
export const Multiple: Story = {
  render: () => (
    <ToggleGroup multiple defaultValue={['info', 'warn', 'error']}>
      <ToggleGroup.Item value="verbose">Verbose</ToggleGroup.Item>
      <ToggleGroup.Item value="info">Info</ToggleGroup.Item>
      <ToggleGroup.Item value="warn">Warn</ToggleGroup.Item>
      <ToggleGroup.Item value="error">Error</ToggleGroup.Item>
    </ToggleGroup>
  ),
};

/** Icon-only items are a first-class case, such as a compact toolbar of log
 * level filters. Pass an icon child and your own `aria-label` on each item.
 * @summary Filter by icon alone, each item labelled for accessibility.
 */
export const IconOnly: Story = {
  render: () => (
    <ToggleGroup multiple defaultValue={['warn', 'error']}>
      <ToggleGroup.Item value="info" aria-label="Info">
        <Info />
      </ToggleGroup.Item>
      <ToggleGroup.Item value="warn" aria-label="Warn">
        <AlertTriangle />
      </ToggleGroup.Item>
      <ToggleGroup.Item value="error" aria-label="Error">
        <XCircle />
      </ToggleGroup.Item>
    </ToggleGroup>
  ),
};

/** `size` is set on both the root and each item, matching how `Tabs` sizes its list and tabs.
 * @summary Three sizes, small to large.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <ToggleGroup size="sm" defaultValue={['list']}>
        <ToggleGroup.Item size="sm" value="list">
          List
        </ToggleGroup.Item>
        <ToggleGroup.Item size="sm" value="grid">
          Grid
        </ToggleGroup.Item>
      </ToggleGroup>
      <ToggleGroup size="md" defaultValue={['list']}>
        <ToggleGroup.Item size="md" value="list">
          List
        </ToggleGroup.Item>
        <ToggleGroup.Item size="md" value="grid">
          Grid
        </ToggleGroup.Item>
      </ToggleGroup>
      <ToggleGroup size="lg" defaultValue={['list']}>
        <ToggleGroup.Item size="lg" value="list">
          List
        </ToggleGroup.Item>
        <ToggleGroup.Item size="lg" value="grid">
          Grid
        </ToggleGroup.Item>
      </ToggleGroup>
    </div>
  ),
};

/** A single item can be disabled while the rest of the group stays interactive.
 * @summary Disable one item within an otherwise active group.
 */
export const DisabledItem: Story = {
  render: () => (
    <ToggleGroup defaultValue={['list']}>
      <ToggleGroup.Item value="list">List</ToggleGroup.Item>
      <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
      <ToggleGroup.Item value="table" disabled>
        Table
      </ToggleGroup.Item>
    </ToggleGroup>
  ),
};
