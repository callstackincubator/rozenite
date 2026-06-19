import { formatTime } from '../transformations';

export type InfoBarProps = {
  totalTime: number;
  totalModules: number;
  entryName: string | undefined;
};

export const InfoBar = ({
  totalTime,
  totalModules,
  entryName,
}: InfoBarProps) => {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border text-xs shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-muted">
          <span>Total Time:</span>
          <span className="text-foreground font-semibold tabular-nums">{formatTime(totalTime)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted">
          <span>Modules:</span>
          <span className="text-foreground font-semibold tabular-nums">{totalModules.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted">
          <span>Entry:</span>
          <span className="text-foreground font-semibold truncate max-w-[200px]">{entryName ?? 'N/A'}</span>
        </div>
      </div>
      <div className="text-muted hidden md:flex items-center gap-1">
        <span>Click to zoom in,</span>
        <kbd className="inline-block px-1 py-0.5 font-mono text-[10px] bg-background border border-border rounded mx-0.5">Esc</kbd>
        <span>to reset</span>
      </div>
    </div>
  );
};
