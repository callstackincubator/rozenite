import type { ReactNode } from 'react';

import styles from './eyebrow.module.css';

type EyebrowProps = {
  children: ReactNode;
  className?: string;
};

export const Eyebrow = ({ children, className }: EyebrowProps) => (
  <p className={[styles.eyebrow, className].filter(Boolean).join(' ')}>
    {children}
  </p>
);
