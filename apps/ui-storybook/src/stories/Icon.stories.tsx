import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon, Search, Settings, Trash2, CheckCircle2 } from '@rozenite/ui';

const meta = {
  component: Icon,
  title: 'Components/Icon',
  parameters: {
    docs: {
      description: {
        component:
          'Renders any icon component at a size from the shared Size scale. Also re-exports a curated lucide set.',
      },
    },
  },
} satisfies Meta<typeof Icon>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Compare the icon at every size step.
 * @summary Compare icon sizes.
 */
export const AllSizes: Story = {
  args: { icon: Search },
  render: () => (
    <div className="flex items-center gap-3">
      <Icon icon={Search} size="sm" />
      <Icon icon={Search} size="md" />
      <Icon icon={Search} size="lg" />
    </div>
  ),
};

/**
 * `icon` accepts any `ComponentType`, including the curated lucide re-exports.
 * @summary Compare a few of the curated lucide icons.
 */
export const CuratedIcons: Story = {
  args: { icon: Settings },
  render: () => (
    <div className="flex items-center gap-3">
      <Icon icon={Settings} />
      <Icon icon={Trash2} />
      <Icon icon={CheckCircle2} />
    </div>
  ),
};
