import type { ComponentProps } from 'react';
import { mergeOverrides } from 'baseui';
import { Input as BaseInput, SIZE } from 'baseui/input/index.js';

type BaseInputProps = ComponentProps<typeof BaseInput>;

export type InputProps = BaseInputProps & {
  spellCheck?: boolean;
};

const inputOverrides = {
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
    }),
  },
  Input: {
    style: {
      paddingTop: '10px',
      paddingRight: '12px',
      paddingBottom: '10px',
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

export const Input = ({ overrides, spellCheck, ...props }: InputProps) => {
  return (
    <BaseInput
      size={SIZE.compact}
      overrides={mergeOverrides(
        inputOverrides,
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
