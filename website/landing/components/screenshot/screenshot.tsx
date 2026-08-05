import styles from './screenshot.module.css';

type ScreenshotSlotProps = {
  /** What the final capture has to show. Written for whoever takes it. */
  shows: string;
  ratio?: 'wide' | 'square';
  className?: string;
};

const RATIO_CLASS = {
  wide: styles.ratioWide,
  square: styles.ratioSquare,
} as const;

/**
 * Reserved space for a real screenshot. See the module CSS for how to swap it
 * out once the captures exist.
 */
export const ScreenshotSlot = ({
  shows,
  ratio = 'wide',
  className,
}: ScreenshotSlotProps) => (
  <figure
    className={[styles.slot, RATIO_CLASS[ratio], className]
      .filter(Boolean)
      .join(' ')}
  >
    <figcaption className={styles.caption}>
      <span className={styles.label}>Screenshot pending</span>
      <span className={styles.what}>{shows}</span>
    </figcaption>
  </figure>
);
