import type { Meta, StoryObj } from '@storybook/react-vite';
import { FlameGraph, type FlameGraphNode } from '@rozenite/ui';

const bundleTree: FlameGraphNode = {
  name: 'bundle.js',
  value: 4200,
  children: [
    {
      name: 'react-native',
      value: 1500,
      children: [
        {
          name: 'Libraries',
          value: 900,
          children: [
            { name: 'Renderer', value: 500 },
            { name: 'Components', value: 400 },
          ],
        },
        { name: 'Libraries/Core', value: 600 },
      ],
    },
    {
      name: 'node_modules',
      value: 1800,
      children: [
        { name: 'lodash', value: 600 },
        {
          name: 'react-navigation',
          value: 700,
          children: [
            { name: 'core', value: 400 },
            { name: 'stack', value: 300 },
          ],
        },
        { name: 'axios', value: 500 },
      ],
    },
    {
      name: 'src',
      value: 900,
      children: [
        {
          name: 'screens',
          value: 500,
          children: [
            { name: 'HomeScreen', value: 250 },
            { name: 'ProfileScreen', value: 250 },
          ],
        },
        { name: 'components', value: 400 },
      ],
    },
  ],
};

const formatKilobytes = (value: number) => `${value} KB`;

const meta = {
  component: FlameGraph,
  title: 'Components/FlameGraph',
} satisfies Meta<typeof FlameGraph>;
export default meta;
type Story = StoryObj;

/** Use to inspect a hierarchical profile — bundle module sizes, call stacks,
 * render timings. Click a frame to zoom into its subtree; press `Escape` to
 * zoom back out.
 * @summary Inspect a hierarchical profile.
 */
export const Default: Story = {
  args: {
    data: bundleTree,
    formatValue: formatKilobytes,
    'aria-label': 'Bundle size flame graph',
    style: { height: 320 },
  },
};

/** Pair `FlameGraph.Legend` with the graph so viewers can read the heat
 * coloring without guessing at the thresholds.
 * @summary Show the heat bucket legend alongside the graph.
 */
export const WithLegend: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <FlameGraph.Legend />
      <FlameGraph
        data={bundleTree}
        formatValue={formatKilobytes}
        aria-label="Bundle size flame graph"
        style={{ height: 320 }}
      />
    </div>
  ),
};

/** Use `highlight` while searching: matching frames keep their heat color and
 * gain an outline, and the rest wash out. The term is matched against each
 * frame's name and its `tooltip`, so path queries work too. Matches are
 * outlined rather than just left undimmed, because a matching frame with no
 * self time sits in the palest bucket and would otherwise read as quieter
 * than the frames around it.
 * @summary Pick out frames matching a search term.
 */
export const Highlighted: Story = {
  args: {
    data: bundleTree,
    formatValue: formatKilobytes,
    highlight: 'react',
    'aria-label': 'Bundle size flame graph, filtered to "react"',
    style: { height: 320 },
  },
};

/** Renders the default empty state when there's no data to profile yet. Pass
 * `emptyState` to override it with custom guidance.
 * @summary Show a placeholder when there's no data yet.
 */
export const Empty: Story = {
  args: {
    data: null,
    style: { height: 320 },
  },
};
