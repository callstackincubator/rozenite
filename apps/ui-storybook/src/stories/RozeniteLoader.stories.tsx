import type { Meta, StoryObj } from '@storybook/react-vite';
import { RozeniteLoader } from '@rozenite/ui';

const meta = {
  component: RozeniteLoader,
  title: 'Components/RozeniteLoader',
  parameters: {
    docs: {
      description: {
        component:
          'A dithered gem loading spinner, masked to the Rozenite logo silhouette. Use it in place of a plain spinner for on-brand loading states.',
      },
    },
  },
  argTypes: {
    cols: {
      control: { type: 'range', min: 4, max: 32, step: 1 },
      description:
        'Grid cells across the logo width. Higher values need a larger `size` to stay legible.',
    },
    period: {
      control: { type: 'range', min: 800, max: 8000, step: 100 },
      description: 'Loop duration in ms.',
    },
    noise: {
      control: { type: 'range', min: 0, max: 1.4, step: 0.05 },
      description: 'Organic grain amount applied to the light field.',
    },
  },
} satisfies Meta<typeof RozeniteLoader>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Play with `cols`, `period`, and `noise` in the Controls panel to see how
 * they change the grid resolution, loop speed, and grain.
 * @summary Tune cols, period, and noise live.
 */
export const Playground: Story = {
  args: {
    size: 96,
    cols: 16,
    period: 3600,
    noise: 0.8,
  },
};

/**
 * Default props at a typical inline size.
 * @summary Default loader at 48px.
 */
export const Default: Story = {
  args: { size: 48 },
};

/**
 * A larger size paired with more grid columns keeps the dithering crisp.
 * @summary Larger loader with a finer grid.
 */
export const Large: Story = {
  args: { size: 96, cols: 26 },
};

/**
 * `paused` freezes the animation on its current frame, e.g. once loading
 * has actually finished.
 * @summary Freeze the animation.
 */
export const Paused: Story = {
  args: { size: 48, paused: true },
};
