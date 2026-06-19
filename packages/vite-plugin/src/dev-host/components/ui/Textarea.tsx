import type { ComponentProps } from 'react';
import { mergeOverrides } from 'baseui';
import { SIZE, Textarea as BaseTextarea } from 'baseui/textarea/index.js';

type BaseTextareaProps = ComponentProps<typeof BaseTextarea>;

export type TextareaProps = BaseTextareaProps & {
  spellCheck?: boolean;
};

const textareaOverrides = {
  Root: {
    style: {
      width: '100%',
      borderWidth: '0',
      backgroundColor: 'transparent',
      paddingLeft: '0',
      paddingRight: '0',
    },
  },
  InputContainer: {
    style: ({ $isFocused }: { $isFocused?: boolean }) => ({
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: '4px',
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      outline: $isFocused ? '2px solid rgba(130, 50, 255, 0.95)' : 'none',
      outlineOffset: '-2px',
      alignItems: 'stretch',
    }),
  },
  Input: {
    style: {
      minHeight: '112px',
      display: 'block',
      alignSelf: 'stretch',
      resize: 'none',
      paddingTop: '12px',
      paddingRight: '12px',
      paddingBottom: '12px',
      paddingLeft: '12px',
      fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
      fontWeight: 400,
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: '12px',
      lineHeight: '1.5',
      letterSpacing: '-0.02em',
      '::placeholder': {
        color: 'rgba(255, 255, 255, 0.36)',
      },
    },
  },
};

export const Textarea = ({ overrides, rows = 6, spellCheck, ...props }: TextareaProps) => {
  return (
    <BaseTextarea
      rows={rows}
      size={SIZE.compact}
      overrides={mergeOverrides(
        textareaOverrides,
        spellCheck === undefined
          ? overrides
          : mergeOverrides(
              {
                Input: {
                  props: {
                    spellCheck,
                  },
                },
              },
              overrides,
            ),
      )}
      {...props}
    />
  );
};
