import { siGooglechrome, siReact } from 'simple-icons';

export type BrandSlug = 'googlechrome' | 'react';

/** Real brand marks, straight from simple-icons. Never redrawn by hand. */
const ICONS = {
  googlechrome: siGooglechrome,
  react: siReact,
} as const;

type BrandMarkProps = {
  slug: BrandSlug;
  label: string;
  size?: number;
  className?: string;
};

/**
 * Rendered in `currentColor` rather than the brand hex, so a mark sits in the
 * page's palette instead of dragging a second accent into it.
 */
export const BrandMark = ({ slug, label, size = 26, className }: BrandMarkProps) => (
  <svg
    role="img"
    aria-label={label}
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
  >
    <path d={ICONS[slug].path} />
  </svg>
);
