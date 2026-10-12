import { cn } from '@rozenite/ui';

/**
 * The Rozenite mark: the stepped crystal on its 7x10 step grid (docs/DESIGN.md, "The mark").
 * It keeps the bright accent in every theme, so the colour is literal rather than the
 * theme-aware `primary` token (which is the deeper crimson in light mode). Keep its height a
 * multiple of 10px so every step stays whole.
 */
export function RozeniteMark({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Rozenite"
      viewBox="0 0 7 10"
      shapeRendering="crispEdges"
      fill="#ff4f7b"
      className={cn('h-5 w-auto', className)}
    >
      <path d="M3 0h1v1h1v2h1v2h1v3h-1v1h-1v1h-3v-1h-1v-1h-1v-3h1v-2h1v-2h1z" />
    </svg>
  );
}

/** "ROZENITE" in Switzer 500, outlined, so the wordmark matches the website's without the
 *  panel bundling Switzer (docs/DESIGN.md, "Wordmark"). Shared with the Storybook logo. */
const WORDMARK_PATH =
  'M1.095 0V-10.2H4.92Q6.57 -10.2 7.545 -9.405Q8.52 -8.61 8.52 -7.26Q8.52 -5.55 7.08 -4.845Q7.905 -4.41 8.235 -3.06L9 0H7.23L6.615 -2.73Q6.42 -3.585 6.03 -3.855Q5.64 -4.125 4.77 -4.125H2.775V0ZM4.875 -8.85H2.775V-5.475H4.845Q5.775 -5.475 6.285 -5.932Q6.795 -6.39 6.795 -7.17Q6.795 -7.95 6.285 -8.4Q5.775 -8.85 4.875 -8.85Z M14.94 0.195Q12.66 0.195 11.347 -1.215Q10.035 -2.625 10.035 -5.085Q10.035 -7.545 11.347 -8.97Q12.66 -10.395 14.94 -10.395Q17.205 -10.395 18.517 -8.97Q19.83 -7.545 19.83 -5.085Q19.83 -2.64 18.517 -1.222Q17.205 0.195 14.94 0.195ZM14.94 -1.215Q16.425 -1.215 17.272 -2.25Q18.12 -3.285 18.12 -5.085Q18.12 -6.9 17.272 -7.942Q16.425 -8.985 14.94 -8.985Q13.44 -8.985 12.592 -7.942Q11.745 -6.9 11.745 -5.085Q11.745 -3.285 12.592 -2.25Q13.44 -1.215 14.94 -1.215Z M21.15 0V-1.41L27 -8.79H21.15V-10.2H28.935V-8.79L23.085 -1.41H28.935V0Z M30.63 0V-10.2H37.665V-8.85H32.31V-5.94H37.095V-4.605H32.31V-1.35H37.665V0Z M39.24 0V-10.2H40.995L45.27 -3.54L45.915 -2.34L45.87 -10.2H47.55V0H45.795L41.535 -6.63L40.875 -7.875L40.92 0Z M49.59 0V-10.2H51.27V0Z M56.055 0V-8.79H52.65V-10.2H61.125V-8.79H57.735V0Z M62.505 0V-10.2H69.54V-8.85H64.185V-5.94H68.97V-4.605H64.185V-1.35H69.54V0Z';

/** The lockup used in the shell: the mark, then the ROZENITE wordmark block. */
export function RozeniteLockup({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Rozenite"
      viewBox="0 0 104.17 24"
      fill="none"
      className={cn('h-6 w-auto', className)}
    >
      <path
        transform="translate(0 2) scale(2)"
        shapeRendering="crispEdges"
        fill="#ff4f7b"
        d="M3 0h1v1h1v2h1v2h1v3h-1v1h-1v1h-3v-1h-1v-1h-1v-3h1v-2h1v-2h1z"
      />
      <rect x="22" y="1" width="82.17" height="22" fill="#ff4f7b" />
      <path transform="translate(28 17.1)" fill="#0a0a0a" d={WORDMARK_PATH} />
    </svg>
  );
}
