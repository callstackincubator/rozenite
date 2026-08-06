import type { ReactNode } from 'react';

import styles from './reveal.module.css';

type RevealProps = {
  children: ReactNode;
  className?: string;
};

/** Fades and lifts its children as they enter the viewport. See the module CSS. */
export const Reveal = ({ children, className }: RevealProps) => (
  <div className={[styles.reveal, className].filter(Boolean).join(' ')}>{children}</div>
);
