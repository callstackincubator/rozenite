import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, IndicatorDot } from '@rozenite/ui';

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

const meta = {
  component: Button,
  title: 'Components/Button',
  parameters: {
    docs: {
      description: {
        component: 'Use Button for actions that change state or submit work.',
      },
    },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Compare the available visual variants when choosing an action emphasis.
 * @summary Compare button action emphasis variants.
 */
export const AllVariants: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Compare the available visual variants when choosing an action emphasis.',
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button>Default</Button>
      <Button tone="neutral">Secondary</Button>
      <Button tone="danger">Delete</Button>
      <Button tone="neutral" variant="outline">
        Outline
      </Button>
      <Button tone="neutral" variant="ghost">
        Ghost
      </Button>
    </div>
  ),
};

/**
 * Pass `render` to render as something other than a `<button>`, e.g. an
 * anchor styled as a button.
 * @summary Render a Button as an anchor.
 */
export const AsAnchor: Story = {
  render: () => (
    <Button
      tone="neutral"
      variant="outline"
      render={<a href="https://rozenite.dev" target="_blank" />}
    >
      Visit docs
    </Button>
  ),
};

/**
 * Use `trailing` to host a status affordance, e.g. an `IndicatorDot`
 * flagging an available update, without a dedicated prop for it.
 * @summary Host an indicator dot via the trailing slot.
 */
export const WithTrailing: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Use `trailing` to host a status affordance next to the button content.',
      },
    },
  },
  render: () => (
    <Button tone="neutral" trailing={<IndicatorDot />}>
      <SettingsIcon className="size-4" />
      Plugins
    </Button>
  ),
};
