import { cn } from '@rozenite/ui';

/**
 * The Rozenite mark: the stepped crystal on its 7x10 step grid (docs/DESIGN.md, "The mark").
 * It keeps the bright accent in every theme, so the colour is literal rather than the
 * theme-aware `primary` token (which is the deeper crimson in light mode).
 */
export function RozeniteMark({
  className,
  decorative = false,
}: {
  className?: string;
  /** Hide it from assistive tech when a visible "Rozenite" label sits next to it. */
  decorative?: boolean;
}) {
  return (
    <svg
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Rozenite'}
      aria-hidden={decorative ? true : undefined}
      viewBox="0 0 7 10"
      shapeRendering="crispEdges"
      fill="#ff4f7b"
      className={cn('h-6 w-auto', className)}
    >
      <path d="M3 0h1v1h1v2h1v2h1v3h-1v1h-1v1h-3v-1h-1v-1h-1v-3h1v-2h1v-2h1z" />
    </svg>
  );
}

/** The lockup used in the shell: the mark, then the ROZENITE wordmark block. */
export function RozeniteLockup({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <RozeniteMark decorative className="h-5" />
      <span
        translate="no"
        className="bg-[#ff4f7b] px-1.5 py-px text-[15px] leading-5 font-medium tracking-[-0.01em] text-[#0a0a0a] uppercase"
      >
        Rozenite
      </span>
    </span>
  );
}
