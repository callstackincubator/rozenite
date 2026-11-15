import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, StepBack, StepForward } from 'lucide-react';
import { IconButton } from '@rozenite/ui';
import { jumpTargets, type StoreHistory } from '../history/model';
import { jumpTo } from '../state/operations';
import { useRunWithToast } from '../state/use-run-with-toast';

const SCRUB_DEBOUNCE_MS = 150;
const PLAY_STEP_MS = 600;

/**
 * Time-travel slider for one store over the states the device still holds.
 * Dragging jumps (debounced); play replays forward one transition at a time.
 */
export function Scrubber({ history }: { history: StoreHistory }) {
  const targets = useMemo(() => jumpTargets(history), [history]);
  const last = targets.length - 1;
  const jumpedTo = history.descriptor.jumpedTo;
  const jumpedIndex = jumpedTo === undefined ? -1 : targets.indexOf(jumpedTo);
  const position = jumpedIndex < 0 ? last : jumpedIndex;
  const [draft, setDraft] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const run = useRunWithToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = draft ?? position;
  const disabled = last < 1;

  /** Resolves to whether the jump went through. */
  const go = (value: number): Promise<boolean> => {
    const target = targets[Math.max(0, Math.min(last, value))];
    return run('Time travel', () => jumpTo(history.storeId, target)).then((ok) => {
      if (!ok) setPlaying(false);
      return ok;
    });
  };

  const scrub = (value: number) => {
    setDraft(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDraft(null);
      void go(value);
    }, SCRUB_DEBOUNCE_MS);
  };

  useEffect(() => {
    if (!playing) return;
    if (position >= last) {
      setPlaying(false);
      return;
    }
    const step = setTimeout(() => void go(position + 1), PLAY_STEP_MS);
    return () => clearTimeout(step);
    // Re-run per step only; `go` closes over nothing that changes mid-replay.
  }, [playing, position, last]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-border px-2 py-1">
      <IconButton
        size="sm"
        tone="neutral"
        variant="ghost"
        disabled={disabled}
        label={playing ? 'Stop replay' : 'Replay forward from here'}
        onClick={() => {
          if (playing) {
            setPlaying(false);
          } else if (position >= last) {
            // Rewind first: playing from the end would stop at once.
            void go(0).then((ok) => ok && setPlaying(true));
          } else {
            setPlaying(true);
          }
        }}
      >
        {playing ? <Pause /> : <Play />}
      </IconButton>
      <IconButton
        size="sm"
        tone="neutral"
        variant="ghost"
        disabled={disabled || shown <= 0}
        label="Step back"
        onClick={() => void go(shown - 1)}
      >
        <StepBack />
      </IconButton>
      <input
        type="range"
        min={0}
        max={Math.max(0, last)}
        value={shown}
        disabled={disabled}
        onChange={(event) => scrub(Number(event.target.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--color-primary)]"
        aria-label={`Time travel ${history.descriptor.name}`}
      />
      <IconButton
        size="sm"
        tone="neutral"
        variant="ghost"
        disabled={disabled || shown >= last}
        label="Step forward"
        onClick={() => void go(shown + 1)}
      >
        <StepForward />
      </IconButton>
      <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {shown}/{Math.max(0, last)}
      </span>
    </div>
  );
}
