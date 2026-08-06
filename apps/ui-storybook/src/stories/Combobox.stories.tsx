import type { Meta, StoryObj } from '@storybook/react-vite';
import { Combobox } from '@rozenite/ui';
const meta = { component: Combobox, title: 'Components/Combobox' } satisfies Meta<typeof Combobox>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { render: () => <Combobox items={['React', 'React Native', 'Vite']}><Combobox.Input placeholder="Search frameworks" /><Combobox.Content>{['React', 'React Native', 'Vite'].map((item) => <Combobox.Item key={item} value={item}>{item}</Combobox.Item>)}</Combobox.Content></Combobox> };
