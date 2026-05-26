import type { Key, ReactNode } from 'react';
import { mergeOverrides } from 'baseui';
import { Segment } from 'baseui/segmented-control/segment.js';
import { SegmentedControl } from 'baseui/segmented-control/index.js';

export type ToggleGroupOption = {
  key: Key;
  label: ReactNode;
  disabled?: boolean;
};

type ToggleGroupProps = {
  value: Key;
  options: ToggleGroupOption[];
  onChange: (value: string) => void;
  'aria-label'?: string;
};

const overrides = {
  Root: {
    style: {
      display: 'inline-flex',
      width: 'fit-content',
      maxWidth: '100%',
      paddingTop: '2px',
      paddingRight: '2px',
      paddingBottom: '2px',
      paddingLeft: '2px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '4px',
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      overflow: 'hidden',
    },
  },
  SegmentList: {
    style: {
      display: 'inline-flex',
      width: 'fit-content',
      minHeight: '22px',
      maxWidth: '100%',
      alignItems: 'center',
      gap: '2px',
      overflow: 'hidden',
      minWidth: 'unset',
      backgroundColor: 'transparent',
      zIndex: 0,
    },
  },
  Active: {
    style: {
      backgroundColor: '#ffffff',
      borderRadius: '2px',
      zIndex: -1,
    },
  },
};

const segmentOverrides = {
  Segment: {
    style: ({ $isActive, $disabled, $isFocusVisible }: { $isActive?: boolean; $disabled?: boolean; $isFocusVisible?: boolean }) => ({
      minHeight: '22px',
      minWidth: 'auto',
      paddingTop: '3px',
      paddingRight: '9px',
      paddingBottom: '3px',
      paddingLeft: '9px',
      borderRadius: '2px',
      backgroundColor: 'transparent',
      color: $isActive ? '#000000' : 'rgba(255, 255, 255, 0.6)',
      fontSize: '12px',
      fontWeight: 500,
      lineHeight: 1.2,
      transitionProperty: 'background-color, color',
      transitionDuration: '120ms',
      outline: $isFocusVisible ? '2px solid rgba(130, 50, 255, 0.95)' : 'none',
      outlineOffset: '-2px',
      cursor: $disabled ? 'default' : 'pointer',
      opacity: $disabled ? 0.4 : 1,
      ':hover': $disabled || $isActive ? undefined : {
        color: '#ffffff',
      },
    }),
  },
  LabelBlock: {
    style: {
      paddingTop: '0',
      paddingRight: '0',
      paddingBottom: '0',
      paddingLeft: '0',
    },
  },
  Label: {
    style: {
      fontSize: '12px',
      fontWeight: 500,
      lineHeight: 1.2,
      color: 'inherit',
    },
  },
};

export const ToggleGroup = ({ value, options, onChange, 'aria-label': ariaLabel }: ToggleGroupProps) => {
  return (
    <SegmentedControl
      activeKey={value}
      onChange={({ activeKey }) => onChange(String(activeKey))}
      overrides={mergeOverrides(overrides, {
        Root: {
          props: {
            'aria-label': ariaLabel,
          },
        },
      })}
    >
      {options.map((option) => (
        <Segment key={option.key} label={option.label} disabled={option.disabled} overrides={segmentOverrides} />
      ))}
    </SegmentedControl>
  );
};
