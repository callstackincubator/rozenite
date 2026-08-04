import type { ReactNode } from 'react';

import styles from './connection-diagram.module.css';

type ConnectionNode = {
  /** Usually a `BrandMark` or a Phosphor glyph. */
  mark: ReactNode;
  label: string;
  meta?: string;
};

type ConnectionDiagramProps = {
  from: ConnectionNode;
  to: ConnectionNode;
  /** Small line under the diagram, for what the connection carries. */
  caption?: string;
  className?: string;
};

const Node = ({ mark, label, meta }: ConnectionNode) => (
  <div className={styles.node}>
    <span className={styles.mark}>{mark}</span>
    <span className={styles.label}>{label}</span>
    {meta ? <span className={styles.meta}>{meta}</span> : null}
  </div>
);

/**
 * Two endpoints and the link between them, in place of a product screenshot.
 *
 * The two dots travelling the line are the page's second and last piece of
 * motion. They earn it: the thing being illustrated is traffic, and a still
 * line cannot show a direction. Both are decorative, so the whole stage is
 * hidden from assistive tech and the endpoints are read from the labels.
 */
export const ConnectionDiagram = ({
  from,
  to,
  caption,
  className,
}: ConnectionDiagramProps) => (
  <figure className={[styles.root, className].filter(Boolean).join(' ')}>
    <div className={styles.stage}>
      <Node {...from} />

      <div className={styles.connector} aria-hidden="true">
        <span className={[styles.pulse, styles.pulseForward].join(' ')} />
        <span className={[styles.pulse, styles.pulseBack].join(' ')} />
      </div>

      <Node {...to} />
    </div>

    {caption ? (
      <figcaption className={styles.caption}>{caption}</figcaption>
    ) : null}
  </figure>
);
