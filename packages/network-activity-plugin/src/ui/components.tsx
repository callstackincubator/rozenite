import React, { useState, useRef } from 'react';
import {
  useFloating,
  useHover,
  useInteractions,
  useRole,
  useDismiss,
  FloatingPortal,
  offset,
  shift,
  flip,
  autoUpdate,
} from '@floating-ui/react';
import styles from './components.module.css';

// Button Component
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  onClick,
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  style,
  className,
}) => {
  const sizeClass =
    size === 'small'
      ? styles.buttonSmall
      : size === 'large'
      ? styles.buttonLarge
      : styles.buttonMedium;
  const variantClass =
    styles[
      `button${
        variant.charAt(0).toUpperCase() + variant.slice(1)
      }` as keyof typeof styles
    ];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${styles.button} ${sizeClass} ${variantClass} ${
        className || ''
      }`}
      style={style}
    >
      {children}
    </button>
  );
};

// Card Component
interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, style, className }) => (
  <div className={`${styles.card} ${className || ''}`} style={style}>
    {children}
  </div>
);

// Badge Component
interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  color = '#007AFF',
  style,
}) => (
  <span className={styles.badge} style={{ backgroundColor: color, ...style }}>
    {children}
  </span>
);

// Toolbar Component
interface ToolbarProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const Toolbar: React.FC<ToolbarProps> = ({ children, style }) => (
  <div className={styles.toolbar} style={style}>
    {children}
  </div>
);

// Panel Header Component
interface PanelHeaderProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  children,
  style,
}) => (
  <div className={styles.panelHeader} style={style}>
    {children}
  </div>
);

// Empty State Component
interface EmptyStateProps {
  message: string;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, style }) => (
  <div className={styles.emptyState} style={style}>
    {message}
  </div>
);

// Loading Spinner Component
interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 16,
  color = '#007AFF',
  style,
}) => (
  <div
    className={styles.loadingSpinner}
    style={{
      width: size,
      height: size,
      borderTopColor: color,
      ...style,
    }}
  />
);

// Tooltip Component using Floating UI
interface TooltipProps {
  children: React.ReactNode;
  content: string;
  style?: React.CSSProperties;
  showOnlyWhenTruncated?: boolean;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  variant?: 'default' | 'info' | 'warning' | 'error';
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  style,
  showOnlyWhenTruncated = false,
  placement = 'top',
  variant = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    middleware: [offset(8), shift(), flip()],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    move: false,
    delay: { open: 200, close: 0 },
  });

  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    dismiss,
    role,
  ]);

  React.useEffect(() => {
    if (showOnlyWhenTruncated && refs.reference.current) {
      const element = refs.reference.current as HTMLElement;
      if (element && 'scrollWidth' in element && 'clientWidth' in element) {
        setIsTruncated(element.scrollWidth > element.clientWidth);
      }
    }
  }, [content, showOnlyWhenTruncated, refs.reference]);

  const shouldShowTooltip = showOnlyWhenTruncated ? isTruncated : true;

  const variantClass =
    styles[
      `tooltip${
        variant.charAt(0).toUpperCase() + variant.slice(1)
      }` as keyof typeof styles
    ];

  return (
    <>
      <div
        ref={refs.setReference}
        className={styles.tooltipReference}
        style={style}
        {...getReferenceProps()}
      >
        {children}
      </div>

      <FloatingPortal>
        {isOpen && (
          <div
            ref={refs.setFloating}
            className={`${styles.tooltipFloating} ${variantClass}`}
            style={floatingStyles}
            {...getFloatingProps()}
          >
            {content}
          </div>
        )}
      </FloatingPortal>
    </>
  );
};
