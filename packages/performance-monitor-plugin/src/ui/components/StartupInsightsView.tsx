import { Column, EmptyState, Row, Text } from '@rozenite/ui';
import { Rocket } from 'lucide-react';
import type { SerializedPerformanceReactNativeMark } from '../../shared/types';
import {
  deriveStartupSummary,
  type StartupPhase,
  type StartupTotal,
} from '../derive-startup-summary';
import { formatDuration } from '../utils';

export type StartupInsightsViewProps = {
  reactNativeMarks: SerializedPerformanceReactNativeMark[];
  isSessionActive: boolean;
};

const DurationCell = ({ phase }: { phase: StartupPhase | StartupTotal }) => {
  if (phase.status === 'missing') {
    return <Text variant="numeric">—</Text>;
  }
  if (phase.status === 'in-progress') {
    return (
      <Text variant="caption" className="italic">
        In progress…
      </Text>
    );
  }
  return (
    <Text variant="numeric" tone="primary" className="font-medium">
      {formatDuration(phase.duration!)}
    </Text>
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

export const StartupInsightsView = ({
  reactNativeMarks,
  isSessionActive,
}: StartupInsightsViewProps) => {
  if (!isSessionActive && reactNativeMarks.length === 0) {
    return (
      <EmptyState
        icon={Rocket}
        title="No startup data"
        description="Start a session to see startup insights."
      />
    );
  }

  const { phases, total } = deriveStartupSummary(reactNativeMarks);
  const totalDuration = total.status === 'complete' ? total.duration : undefined;

  return (
    <Column scroll fill className="p-4">
      <Row align="center" gap={4} className="border-b border-border py-2.5">
        <Text variant="heading" className="w-40 shrink-0">
          Total startup
        </Text>
        <div className="w-24 shrink-0">
          <DurationCell phase={total} />
        </div>
      </Row>

      {phases.map((phase) => (
        <Row key={phase.name} align="center" gap={4} className="border-b border-border py-2.5">
          <Text variant="body" className="w-40 shrink-0 text-muted-foreground">
            {phase.label}
          </Text>
          <div className="w-24 shrink-0">
            <DurationCell phase={phase} />
          </div>
          <PhaseBar phase={phase} totalDuration={totalDuration} />
        </Row>
      ))}
    </Column>
  );
};
