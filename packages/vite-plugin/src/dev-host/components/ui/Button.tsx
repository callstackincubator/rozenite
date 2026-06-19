import type { ComponentProps } from 'react';
import { mergeOverrides } from 'baseui';
import { Button as BaseButton, KIND, SHAPE, SIZE, WIDTH_TYPE, type ButtonOverrides } from 'baseui/button/index.js';

type ButtonVariant = 'default' | 'primary' | 'pill';

type BaseButtonProps = ComponentProps<typeof BaseButton>;

export type ButtonProps = Omit<BaseButtonProps, 'kind' | 'shape' | 'size' | 'widthType'> & {
  variant?: ButtonVariant;
};

const baseOverrides: ButtonOverrides = {
  BaseButton: {
    style: ({ $disabled, $isFocusVisible }) => ({
      minHeight: 'auto',
      minWidth: 'auto',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: '4px',
      backgroundColor: 'transparent',
      color: 'rgba(255, 255, 255, 0.56)',
      paddingTop: '0',
      paddingRight: '0',
      paddingBottom: '0',
      paddingLeft: '0',
      boxShadow: 'none',
      cursor: $disabled ? 'default' : 'pointer',
      opacity: $disabled ? 0.4 : 1,
      outline: $isFocusVisible ? '2px solid rgba(130, 50, 255, 0.95)' : 'none',
      outlineOffset: '-2px',
    }),
  },
};

const variantOverrides: Record<ButtonVariant, ButtonOverrides> = {
  default: {
    BaseButton: {
      style: ({ $disabled, $isHovered }) => ({
        borderColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: !$disabled && $isHovered ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
        color: 'rgba(255, 255, 255, 0.56)',
      }),
    },
  },
  primary: {
    BaseButton: {
      style: ({ $disabled, $isHovered }) => ({
        borderColor: '#ffffff',
        backgroundColor: '#ffffff',
        color: '#000000',
        opacity: $disabled ? 0.4 : 1,
        ':hover': !$disabled && $isHovered ? { backgroundColor: 'rgba(255, 255, 255, 0.88)' } : undefined,
      }),
    },
  },
  pill: {
    BaseButton: {
      style: ({ $disabled, $isHovered, $isSelected }) => ({
        borderColor: $isSelected ? 'rgba(130, 50, 255, 0.5)' : 'rgba(255, 255, 255, 0.08)',
        borderRadius: '999px',
        backgroundColor: $isSelected
          ? 'rgba(130, 50, 255, 0.18)'
          : !$disabled && $isHovered
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(255, 255, 255, 0.04)',
        color: '#ffffff',
        paddingTop: '6px',
        paddingRight: '10px',
        paddingBottom: '6px',
        paddingLeft: '10px',
        fontSize: '12px',
        lineHeight: '1.4',
      }),
    },
  },
};

export const Button = ({ overrides, variant = 'default', ...props }: ButtonProps) => {
  return (
    <BaseButton
      kind={KIND.tertiary}
      shape={variant === 'pill' ? SHAPE.pill : SHAPE.rectangular}
      size={SIZE.compact}
      widthType={WIDTH_TYPE.hug}
      overrides={mergeOverrides(mergeOverrides(baseOverrides, variantOverrides[variant]), overrides)}
      {...props}
    />
  );
};
