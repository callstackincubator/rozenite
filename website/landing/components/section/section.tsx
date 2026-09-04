import type { ReactNode } from 'react';

import { Eyebrow } from '../eyebrow/eyebrow';
import { Reveal } from '../reveal/reveal';
import styles from './section.module.css';

type SectionTint = 'default' | 'subtle' | 'block';

type SectionProps = {
  id?: string;
  tint?: SectionTint;
  /** Hairline above the section. Off when the tint change already separates it. */
  bordered?: boolean;
  className?: string;
  children: ReactNode;
};

const TINT_CLASS: Record<SectionTint, string> = {
  default: '',
  subtle: styles.tintSubtle,
  block: styles.tintBlock,
};

export const Section = ({
  id,
  tint = 'default',
  bordered = false,
  className,
  children,
}: SectionProps) => (
  <section
    id={id}
    className={[styles.section, TINT_CLASS[tint], bordered ? styles.bordered : '', className]
      .filter(Boolean)
      .join(' ')}
  >
    <div className={styles.container}>{children}</div>
  </section>
);

type SectionHeaderProps = {
  /**
   * Small label above the headline. Rationed on purpose: only the product
   * surfaces (plugins, agents, Lynx, web) carry one. `ReactNode` rather than
   * `string` so a surface can pair its label with a brand mark or a status
   * chip on the same line -- not so it can grow into a second headline.
   */
  eyebrow?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** For sections that place the header inside a layout of their own. */
  className?: string;
};

export const SectionHeader = ({ eyebrow, title, body, className }: SectionHeaderProps) => (
  <Reveal>
    <div className={[styles.header, className].filter(Boolean).join(' ')}>
      {eyebrow ? <Eyebrow className={styles.eyebrow}>{eyebrow}</Eyebrow> : null}
      <h2 className={styles.title}>{title}</h2>
      {body ? <p className={styles.body}>{body}</p> : null}
    </div>
  </Reveal>
);
