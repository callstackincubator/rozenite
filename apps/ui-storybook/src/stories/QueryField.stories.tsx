import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { QueryField, type QueryToken } from '@rozenite/ui';

// QueryField highlights its built-in filter grammar out of the box, so these
// stories pass a value and nothing else — edit the field and the colors
// follow the text. `CustomGrammar` below shows the escape hatch for a panel
// that brings its own query language.
const realisticQuery = 'level>=warn tag:auth -"retry"';

const meta = {
  component: QueryField,
  title: 'Components/QueryField',
} satisfies Meta<typeof QueryField>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledQueryField(props: {
  initialValue: string;
  tokens?: QueryToken[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(props.initialValue);

  return (
    <QueryField
      value={value}
      onValueChange={setValue}
      onClear={() => setValue('')}
      tokens={props.tokens}
      size={props.size}
      className={props.className}
      placeholder={props.placeholder}
    />
  );
}

/** A realistic log query painted by the built-in grammar — field, operator,
 * value, and negation. Type into it: the highlighting is recomputed from the
 * text on every keystroke, so it tracks edits of any length.
 * @summary A log query with field, operator, value, and negation highlighted.
 */
export const Default: Story = {
  render: () => (
    <div className="w-96">
      <ControlledQueryField initialValue={realisticQuery} />
    </div>
  ),
};

/** An unterminated quote is the one thing the built-in grammar calls a
 * mistake, and it gets the danger/wavy-underline treatment. A half-typed
 * clause like `level>=` is left alone — it is a query in progress.
 * @summary An unterminated quote flagged as an error.
 */
export const ErrorToken: Story = {
  render: () => (
    <div className="w-96">
      <ControlledQueryField initialValue={'level=warn tag:"auth'} />
    </div>
  ),
};

/** With no value and no tokens, QueryField falls back to its placeholder like
 * any other text input.
 * @summary Empty state with a placeholder.
 */
export const Empty: Story = {
  render: () => (
    <div className="w-96">
      <ControlledQueryField initialValue="" placeholder="level>=warn tag:auth…" />
    </div>
  ),
};

/** `size` scales the same way as the rest of the form controls in this kit.
 * @summary Three sizes, small to large.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-3">
      <ControlledQueryField initialValue={realisticQuery} size="sm" />
      <ControlledQueryField initialValue={realisticQuery} size="md" />
      <ControlledQueryField initialValue={realisticQuery} size="lg" />
    </div>
  ),
};

const longQuery =
  'level>=warn tag:auth service:checkout region:us-east-1 -"retry" -"heartbeat" status:failed duration>1500 user.id:8231';

/** The value is wider than the field, so the text scrolls horizontally inside
 * its lane. The lane stops where the clear button begins, so the button stays
 * legible on the field's own background no matter how long the query gets,
 * and the mirror's `scrollLeft` follows the input's so the colors never drift
 * from the caret. Click into the field and press End to scroll it.
 * @summary A long query scrolling under a clear button that stays visible.
 */
export const LongQueryScrollSync: Story = {
  render: () => (
    <div className="w-72">
      <ControlledQueryField initialValue={longQuery} />
    </div>
  ),
};

/** A panel with its own query language passes `tokens` and the built-in
 * grammar is bypassed entirely — here a SQL-ish dialect the grammar knows
 * nothing about, tokenized by the caller.
 * @summary Caller-supplied token ranges replacing the built-in grammar.
 */
export const CustomGrammar: Story = {
  render: () => (
    <div className="w-96">
      <ControlledQueryField
        initialValue="SELECT * WHERE level IN (warn, error)"
        tokens={[
          { start: 0, end: 6, kind: 'operator' }, // SELECT
          { start: 9, end: 14, kind: 'operator' }, // WHERE
          { start: 15, end: 20, kind: 'field' }, // level
          { start: 21, end: 23, kind: 'operator' }, // IN
          { start: 24, end: 37, kind: 'value' }, // (warn, error)
        ]}
      />
    </div>
  ),
};
