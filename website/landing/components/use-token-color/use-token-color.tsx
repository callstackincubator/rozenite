import { useEffect, useState, type RefObject } from 'react';

/**
 * Resolves a `--rz-*` token to the concrete colour it currently holds.
 *
 * Canvas cannot read CSS: `ctx.fillStyle = 'var(--rz-accent)'` is invalid and
 * is silently ignored, leaving whatever was set before it. So anything drawing
 * to a canvas has to be handed a real colour, and be handed a new one when the
 * theme flips.
 *
 * Returns `fallback` until the first measurement, which matters during SSG --
 * Rspress renders these components on the server, where there is no computed
 * style to read.
 */
export const useTokenColor = (
  ref: RefObject<HTMLElement | null>,
  token: string,
  fallback: string,
): string => {
  const [color, setColor] = useState(fallback);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const read = () => {
      const value = getComputedStyle(element).getPropertyValue(token).trim();

      if (value) {
        setColor(value);
      }
    };

    read();

    // Both are in play: Rspress toggles `html.dark`, and the token file also
    // honours `[data-theme]`.
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    return () => observer.disconnect();
  }, [ref, token]);

  return color;
};
