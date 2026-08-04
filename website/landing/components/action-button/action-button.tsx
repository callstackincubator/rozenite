import { ArrowRight, ArrowUpRight, type Icon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

import styles from './action-button.module.css';

type ActionButtonProps = {
  href: string;
  children: ReactNode;
  variant?: 'solid' | 'outline' | 'quiet';
  icon?: Icon;
  external?: boolean;
  fullWidth?: boolean;
  className?: string;
};

export const ActionButton = ({
  href,
  children,
  variant = 'solid',
  icon,
  external = false,
  fullWidth = false,
  className,
}: ActionButtonProps) => {
  const Glyph = icon ?? (external ? ArrowUpRight : ArrowRight);

  return (
    <a
      href={href}
      className={[
        styles.button,
        styles[variant],
        fullWidth ? styles.full : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
    >
      <span>{children}</span>
      <span className={styles.icon}>
        <Glyph size={17} weight="bold" />
      </span>
    </a>
  );
};
