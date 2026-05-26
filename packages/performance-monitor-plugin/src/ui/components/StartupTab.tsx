import { Box, Flex, Text } from '@radix-ui/themes';
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
      <Text
        size="2"
        color="gray"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        —
      </Text>
    );
  }
  if (phase.status === 'in-progress') {
    return (
      <Text size="2" color="gray" style={{ fontStyle: 'italic' }}>
        In progress…
      </Text>
    );
  }
  return (
    <Text
      size="2"
      color="blue"
      style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}
    >
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
  if (
    phase.status !== 'complete' ||
    totalDuration == null ||
    !(totalDuration > 0)
  ) {
    return null;
  }
  const pct = Math.min((phase.duration! / totalDuration) * 100, 100);
  return (
    <Box
      style={{
        flex: 1,
        height: '8px',
        borderRadius: '4px',
        background: BAR_TRACK_COLOR,
        overflow: 'hidden',
      }}
    >
      <Box
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: '4px',
          background: BAR_COLOR,
        }}
      />
    </Box>
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
      <Flex align="center" justify="center" style={{ flex: 1, height: '100%' }}>
        <Text color="gray" size="2">
          Start a session to see startup data
        </Text>
      </Flex>
    );
  }

  const { phases, total } = deriveStartupSummary(reactNativeMarks);
  const totalDuration =
    total.status === 'complete' ? total.duration : undefined;

  return (
    <Box p="4" style={{ overflowY: 'auto', height: '100%' }}>
      {/* Total row */}
      <Flex align="center" gap="4" style={ROW_STYLE}>
        <Box style={{ width: '160px', flexShrink: 0 }}>
          <Text size="2" weight="bold">
            Total startup
          </Text>
        </Box>
        <Box style={{ width: '90px', flexShrink: 0 }}>
          <DurationCell phase={total} />
        </Box>
      </Flex>

      {/* Phase rows */}
      {phases.map((phase) => (
        <Flex key={phase.name} align="center" gap="4" style={ROW_STYLE}>
          <Box style={{ width: '160px', flexShrink: 0 }}>
            <Text size="2" color="gray">
              {phase.label}
            </Text>
          </Box>
          <Box style={{ width: '90px', flexShrink: 0 }}>
            <DurationCell phase={phase} />
          </Box>
          <PhaseBar phase={phase} totalDuration={totalDuration} />
        </Flex>
      ))}
    </Box>
  );
};
