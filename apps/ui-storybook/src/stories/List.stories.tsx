import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, List } from '@rozenite/ui';

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  );
}

const meta = { component: List, title: 'Components/List' } satisfies Meta<typeof List>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use for a flat, grouped list of selectable items with optional leading and trailing content.
 * @summary Navigate a flat, grouped list.
 */
export const Default: Story = {
  render: () => (
    <div className="h-72 w-56 border border-border p-2">
      <List>
        <List.Group label="Local Storage">
          <List.Item
            selected
            adornment={<DatabaseIcon />}
            trailing={<Badge variant="secondary">3</Badge>}
          >
            auth-token
          </List.Item>
          <List.Item adornment={<DatabaseIcon />}>user-preferences</List.Item>
        </List.Group>
        <List.Group label="Session Storage">
          <List.Item adornment={<DatabaseIcon />}>draft-form</List.Item>
        </List.Group>
      </List>
    </div>
  ),
};

/** Pass `render` to render an item as something other than a `<button>`,
 * e.g. an anchor for a navigable entry.
 * @summary Render a List.Item as an anchor.
 */
export const AsAnchor: Story = {
  render: () => (
    <div className="w-56 border border-border p-2">
      <List>
        <List.Item adornment={<DatabaseIcon />} render={<a href="#docs" />}>
          View documentation
        </List.Item>
      </List>
    </div>
  ),
};
