import type { Meta, StoryObj } from '@storybook/react-vite';
import { Link } from '@rozenite/ui';

const meta = {
  component: Link,
  title: 'Components/Link',
} satisfies Meta<typeof Link>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Compare an in-app link with a link that leaves the app.
 * @summary Compare internal and external links.
 */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-2 text-sm">
      <Link href="#">Internal link</Link>
      <Link href="https://www.npmjs.com" external>
        View on npm
      </Link>
    </div>
  ),
};
