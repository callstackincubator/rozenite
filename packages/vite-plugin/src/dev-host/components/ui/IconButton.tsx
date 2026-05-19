import type { ReactNode } from 'react';
import { mergeOverrides } from 'baseui';
import type { ButtonProps } from './Button.js';
import { Button } from './Button.js';

export type IconButtonProps = Omit<ButtonProps, 'children'> & {
  children: ReactNode;
};

export const IconButton = ({ overrides, children, ...props }: IconButtonProps) => {
  return (
    <Button
      overrides={mergeOverrides(
        {
          BaseButton: {
            style: ({ $disabled, $isHovered, $isFocusVisible }: { $disabled?: boolean; $isHovered?: boolean; $isFocusVisible?: boolean }) => ({
              width: '28px',
              height: '28px',
              minWidth: '28px',
              minHeight: '28px',
              borderWidth: '0',
              borderRadius: '4px',
              backgroundColor: !$disabled && $isHovered ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
              color: !$disabled && $isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.56)',
              paddingTop: '0',
              paddingRight: '0',
              paddingBottom: '0',
              paddingLeft: '0',
              outline: $isFocusVisible ? '2px solid rgba(130, 50, 255, 0.95)' : 'none',
              outlineOffset: '-2px',
            }),
          },
        },
        overrides,
      )}
      {...props}
    >
      {children}
    </Button>
  );
};
