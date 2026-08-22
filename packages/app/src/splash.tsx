import { useEffect, useRef, useState } from 'react';
import { cn, RozeniteLoader } from '@rozenite/ui';

/** A device on the same machine can connect in a couple of hundred
 * milliseconds, and a splash that blinks in and straight back out reads as
 * a glitch rather than as loading. */
const MIN_VISIBLE_MS = 450;

/** Must stay in sync with `duration-[400ms]` below, which has to be a
 * literal for Tailwind's source scanner to see it. */
const FADE_MS = 400;

type Phase = 'hidden' | 'visible' | 'fading';

export interface SplashProps {
  visible: boolean;
}

/**
 * `aria-hidden` because it's a purely visual cover: the footer's status
 * badge stays in the accessibility tree underneath, so the loader must not
 * duplicate it as a second status. `z-40` keeps it under `Dialog`'s
 * `z-50`, which is what lets a status dialog sit on top of it.
 */
export function Splash({ visible }: SplashProps) {
  const [phase, setPhase] = useState<Phase>(visible ? 'visible' : 'hidden');
  const shownAtRef = useRef(Date.now());

  useEffect(() => {
    if (visible) {
      shownAtRef.current = Date.now();
      setPhase('visible');
      return;
    }

    if (phase === 'hidden') {
      return;
    }

    const holdMs = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAtRef.current));
    const fadeTimer = setTimeout(() => setPhase('fading'), holdMs);
    const doneTimer = setTimeout(() => setPhase('hidden'), holdMs + FADE_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
    // `phase` is a dependency so the guard above sees what the timers set.
    // Re-running on `visible` → `fading` only re-arms the unmount a full
    // fade after the fade actually started, which is what we want anyway.
  }, [visible, phase]);

  if (phase === 'hidden') {
    return null;
  }

  return (
    <div
      aria-hidden
      data-slot="splash"
      className={cn(
        'fixed inset-0 z-40 flex items-center justify-center bg-background',
        'transition-opacity duration-[400ms] ease-out motion-reduce:transition-none',
        phase === 'fading' ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
    >
      <RozeniteLoader size={96} cols={26} label="" />
    </div>
  );
}
