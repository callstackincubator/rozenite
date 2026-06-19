import type { SerializedPerformanceReactNativeMark } from '../../shared/types';
import {
  deriveStartupSummary,
  type StartupPhase,
  type StartupTotal,
} from '../derive-startup-summary';
import { formatDuration } from '../utils';

type StartupTabProps = {
  reactNativeMarks: SerializedPerformanceReactNativeMark[];
  isSessionActive: boolean;
};

const BAR_COLOR = 'hsl(212 100% 48%)';
const BAR_TRACK_COLOR = 'hsl(0 0% 14.9%)';

const DurationCell = ({ phase }: { phase: StartupPhase | StartupTotal }) => {
  if (phase.status === 'missing') {
    return (
      <span
        className="text-sm text-muted"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        —
      </span>
    );
  }
  if (phase.status === 'in-progress') {
    return (
      <span className="text-sm text-muted" style={{ fontStyle: 'italic' }}>
        In progress…
      </span>
    );
  }
  return (
    <span
      className="text-sm text-primary"
      style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}
    >
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
  if (
    phase.status !== 'complete' ||
    totalDuration == null ||
    !(totalDuration > 0)
  ) {
    return null;
  }
  const pct = Math.min((phase.duration! / totalDuration) * 100, 100);
  return (
    <div
      style={{
        flex: 1,
        height: '8px',
        borderRadius: '4px',
        background: BAR_TRACK_COLOR,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: '4px',
          background: BAR_COLOR,
        }}
      />
    </div>
  );
};

const ROW_STYLE: React.CSSProperties = {
  borderBottom: '1px solid hsl(0 0% 14.9%)',
  padding: '10px 0',
};

export const StartupTab = ({
  reactNativeMarks,
  isSessionActive,
}: StartupTabProps) => {
  if (!isSessionActive && reactNativeMarks.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ flex: 1, height: '100%' }}>
        <span className="text-sm text-muted">
          Start a session to see startup data
        </span>
      </div>
    );
  }

  const { phases, total } = deriveStartupSummary(reactNativeMarks);
  const totalDuration =
    total.status === 'complete' ? total.duration : undefined;

  return (
    <div className="p-4" style={{ overflowY: 'auto', height: '100%' }}>
      {/* Total row */}
      <div className="flex items-center gap-4" style={ROW_STYLE}>
        <div style={{ width: '160px', flexShrink: 0 }}>
          <span className="text-sm font-bold">Total startup</span>
        </div>
        <div style={{ width: '90px', flexShrink: 0 }}>
          <DurationCell phase={total} />
        </div>
      </div>

      {/* Phase rows */}
      {phases.map((phase) => (
        <div key={phase.name} className="flex items-center gap-4" style={ROW_STYLE}>
          <div style={{ width: '160px', flexShrink: 0 }}>
            <span className="text-sm text-muted">{phase.label}</span>
          </div>
          <div style={{ width: '90px', flexShrink: 0 }}>
            <DurationCell phase={phase} />
          </div>
          <PhaseBar phase={phase} totalDuration={totalDuration} />
        </div>
      ))}
    </div>
  );
};
