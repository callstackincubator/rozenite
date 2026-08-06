import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field } from '../../../../packages/ui/src/field/field';
const meta = { component: Field, title: 'Components/Field' } satisfies Meta<
  typeof Field
>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Use to connect a form control with its label and supporting help text.
 * @summary Pair a control with form guidance.
 */
export const Default: Story = {
  render: () => (
    <Field className="w-72">
      <Field.Label>Project name</Field.Label>
      <Field.Control placeholder="Rozenite" />
      <Field.Description>A name shown in the DevTools panel.</Field.Description>
    </Field>
  ),
};
