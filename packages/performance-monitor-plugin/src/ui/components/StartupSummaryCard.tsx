import { Card } from '@rozenite/ui';
import type { SerializedPerformanceReactNativeMark } from '../../shared/types';
import {
  deriveStartupSummary,
  type StartupPhase,
  type StartupTotal,
} from '../derive-startup-summary';
import { formatDuration } from '../utils';

export type StartupSummaryCardProps = {
  reactNativeMarks: SerializedPerformanceReactNativeMark[];
};

const DurationLabel = ({ phase }: { phase: StartupPhase | StartupTotal }) => {
  if (phase.status === 'missing') {
    return <span className="tabular-nums text-xs text-muted-foreground">—</span>;
  }
  if (phase.status === 'in-progress') {
    return <span className="text-xs italic text-muted-foreground">In progress…</span>;
  }
  return (
    <span className="tabular-nums text-xs font-medium text-primary">
      {formatDuration(phase.duration!)}
    </span>
  );
};

const PhaseBar = ({
  phase,
  totalDuration,
}: {
  phase: StartupPhase;
  totalDuration: number | undefined;
}) => {
  if (phase.status !== 'complete' || totalDuration == null || !(totalDuration > 0)) {
    return null;
  }
  const pct = Math.min((phase.duration! / totalDuration) * 100, 100);
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
};

// Startup used to be a whole tab (`StartupTab`) that recomputed the same
// paired Start/End react-native-marks that `deriveStartupPhases` already
// folds into Measures (marked "RN"). Per the v2 IA doc this is now a
// collapsed-by-default summary card above the waterfall — same totals/bar
// content, reusing `deriveStartupSummary` verbatim, just demoted from a tab.
export const StartupSummaryCard = ({ reactNativeMarks }: StartupSummaryCardProps) => {
  const { phases, total } = deriveStartupSummary(reactNativeMarks);

  if (total.status === 'missing') {
    return null;
  }

  const totalDuration = total.status === 'complete' ? total.duration : undefined;

  return (
    <Card collapsible defaultOpen={false} className="m-2 shrink-0">
      <Card.Header>
        <span className="min-w-0 flex-1 text-sm font-medium text-foreground">Startup</span>
        <DurationLabel phase={total} />
      </Card.Header>
      <Card.Body>
        <div className="flex flex-col gap-2">
          {phases.map((phase) => (
            <div key={phase.name} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-xs text-muted-foreground">{phase.label}</span>
              <span className="w-20 shrink-0">
                <DurationLabel phase={phase} />
              </span>
              <PhaseBar phase={phase} totalDuration={totalDuration} />
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
};
