import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { QueryField, type QueryToken } from '@rozenite/ui';

// QueryField is presentation-only — it has no query grammar. Tokenizing
// `level>=warn tag:auth -"retry"` is entirely the story's (the consumer's)
// job; QueryField only paints the ranges it's handed.
const realisticQuery = 'level>=warn tag:auth -"retry"';
const realisticTokens: QueryToken[] = [
  { start: 0, end: 5, kind: 'field' }, // level
  { start: 5, end: 7, kind: 'operator' }, // >=
  { start: 7, end: 11, kind: 'value' }, // warn
  { start: 12, end: 15, kind: 'field' }, // tag
  { start: 15, end: 16, kind: 'operator' }, // :
  { start: 16, end: 20, kind: 'value' }, // auth
  { start: 21, end: 22, kind: 'negation' }, // -
  { start: 22, end: 29, kind: 'value' }, // "retry"
];

const meta = {
  component: QueryField,
  title: 'Components/QueryField',
} satisfies Meta<typeof QueryField>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledQueryField(props: {
  initialValue: string;
  tokens: QueryToken[];
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

/** A realistic pre-tokenized log query, showing field/operator/value/negation
 * painted over plain text as the user would type it into a log panel.
 * @summary A log query with field, operator, value, and negation highlighted.
 */
export const Default: Story = {
  render: () => (
    <div className="w-96">
      <ControlledQueryField initialValue={realisticQuery} tokens={realisticTokens} />
    </div>
  ),
};

/** The caller marks a malformed fragment as `error`; QueryField only applies
 * the danger/wavy-underline treatment — it never judges validity itself.
 * @summary An unterminated quote flagged as an error token.
 */
export const ErrorToken: Story = {
  render: () => (
    <div className="w-96">
      <ControlledQueryField
        initialValue='level=warn tag:"auth'
        tokens={[
          { start: 0, end: 5, kind: 'field' },
          { start: 5, end: 6, kind: 'operator' },
          { start: 6, end: 10, kind: 'value' },
          { start: 11, end: 14, kind: 'field' },
          { start: 14, end: 15, kind: 'operator' },
          { start: 15, end: 20, kind: 'error' },
        ]}
      />
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
      <ControlledQueryField initialValue="" tokens={[]} placeholder="level>=warn tag:auth…" />
    </div>
  ),
};

/** `size` scales the same way as the rest of the form controls in this kit.
 * @summary Three sizes, small to large.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-3">
      <ControlledQueryField initialValue={realisticQuery} tokens={realisticTokens} size="sm" />
      <ControlledQueryField initialValue={realisticQuery} tokens={realisticTokens} size="md" />
      <ControlledQueryField initialValue={realisticQuery} tokens={realisticTokens} size="lg" />
    </div>
  ),
};

const longQuery =
  'level>=warn tag:auth service:checkout region:us-east-1 -"retry" -"heartbeat" status:failed duration>1500 user.id:8231';
const longQueryTokens: QueryToken[] = [
  { start: 0, end: 5, kind: 'field' },
  { start: 5, end: 7, kind: 'operator' },
  { start: 7, end: 11, kind: 'value' },
  { start: 12, end: 15, kind: 'field' },
  { start: 15, end: 16, kind: 'operator' },
  { start: 16, end: 20, kind: 'value' },
  { start: 21, end: 28, kind: 'field' },
  { start: 28, end: 29, kind: 'operator' },
  { start: 29, end: 37, kind: 'value' },
  { start: 38, end: 44, kind: 'field' },
  { start: 44, end: 45, kind: 'operator' },
  { start: 45, end: 54, kind: 'value' },
  { start: 55, end: 56, kind: 'negation' },
  { start: 56, end: 63, kind: 'value' },
  { start: 64, end: 65, kind: 'negation' },
  { start: 65, end: 76, kind: 'value' },
  { start: 77, end: 83, kind: 'field' },
  { start: 83, end: 84, kind: 'operator' },
  { start: 84, end: 90, kind: 'value' },
  { start: 91, end: 99, kind: 'field' },
  { start: 99, end: 100, kind: 'operator' },
  { start: 100, end: 104, kind: 'value' },
  { start: 105, end: 112, kind: 'field' },
  { start: 112, end: 113, kind: 'operator' },
  { start: 113, end: 117, kind: 'value' },
];

/** The value is wider than the field, so the input scrolls horizontally.
 * QueryField syncs the mirror's `scrollLeft` to the input's on every scroll
 * event so the painted colors never drift from the caret. Click into the
 * field and use the arrow keys or End to scroll it and see the highlight
 * track along.
 * @summary A long query demonstrating horizontal scroll stays in sync.
 */
export const LongQueryScrollSync: Story = {
  render: () => (
    <div className="w-72">
      <ControlledQueryField initialValue={longQuery} tokens={longQueryTokens} />
    </div>
  ),
};
