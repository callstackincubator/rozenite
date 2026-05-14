import { Box, Text, Heading, Separator, Flex, Grid } from '@radix-ui/themes';
import { SerializedPerformanceResource } from '../../shared/types';
import { formatTime, formatDuration, formatBytes } from '../utils';

export type ResourceDetailsProps = {
  resource: SerializedPerformanceResource;
};

const formatPhase = (value: number | undefined): string => {
  if (value === undefined || value === 0) return '—';
  return `${value.toFixed(2)}ms`;
};

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <Box mb="3">
    <Flex align="center" gap="3">
      <Text size="2" color="gray" style={{ minWidth: '140px' }}>
        {label}
      </Text>
      {children}
    </Flex>
  </Box>
);

const TIMING_FIELDS: Array<{
  key: keyof SerializedPerformanceResource;
  label: string;
}> = [
  { key: 'redirectStart', label: 'Redirect start' },
  { key: 'redirectEnd', label: 'Redirect end' },
  { key: 'fetchStart', label: 'Fetch start' },
  { key: 'domainLookupStart', label: 'DNS start' },
  { key: 'domainLookupEnd', label: 'DNS end' },
  { key: 'connectStart', label: 'Connect start' },
  { key: 'secureConnectionStart', label: 'TLS start' },
  { key: 'connectEnd', label: 'Connect end' },
  { key: 'requestStart', label: 'Request start' },
  { key: 'responseStart', label: 'Response start' },
  { key: 'responseEnd', label: 'Response end' },
  { key: 'workerStart', label: 'Worker start' },
];

export const ResourceDetails = ({ resource }: ResourceDetailsProps) => {
  return (
    <Box>
      <Heading size="5" mb="4">
        Resource Details
      </Heading>

      <Row label="Name:">
        <Text weight="medium" size="3" style={{ wordBreak: 'break-all' }}>
          {resource.name}
        </Text>
      </Row>

      <Row label="Type:">
        <Text size="3">{resource.initiatorType ?? '—'}</Text>
      </Row>

      <Row label="Duration:">
        <Text color="blue" weight="medium" size="3">
          {formatDuration(resource.duration)}
        </Text>
      </Row>

      <Row label="Recorded at:">
        <Text size="3">{formatTime(resource.startTime)}</Text>
      </Row>

      <Separator size="4" my="4" />

      <Heading size="3" mb="3">
        Sizes
      </Heading>
      <Row label="Transfer size:">
        <Text size="3">{formatBytes(resource.transferSize)}</Text>
      </Row>
      <Row label="Encoded body:">
        <Text size="3">{formatBytes(resource.encodedBodySize)}</Text>
      </Row>
      <Row label="Decoded body:">
        <Text size="3">{formatBytes(resource.decodedBodySize)}</Text>
      </Row>

      <Separator size="4" my="4" />

      <Heading size="3" mb="3">
        Timing phases
      </Heading>
      <Text size="2" color="gray" mb="3" as="div">
        Phase timestamps are relative to the session, not clock-shifted.
      </Text>
      <Grid columns="2" gap="2">
        {TIMING_FIELDS.map(({ key, label }) => (
          <Flex key={key} align="center" gap="2">
            <Text size="2" color="gray" style={{ minWidth: '120px' }}>
              {label}:
            </Text>
            <Text size="2">
              {formatPhase(resource[key] as number | undefined)}
            </Text>
          </Flex>
        ))}
      </Grid>

      {resource.serverTiming.length > 0 && (
        <>
          <Separator size="4" my="4" />
          <Heading size="3" mb="3">
            Server timing
          </Heading>
          <Text size="2" style={{ fontFamily: 'monospace' }}>
            [{resource.serverTiming.join(', ')}]
          </Text>
        </>
      )}

      {resource.workerTiming.length > 0 && (
        <>
          <Separator size="4" my="4" />
          <Heading size="3" mb="3">
            Worker timing
          </Heading>
          <Text size="2" style={{ fontFamily: 'monospace' }}>
            [{resource.workerTiming.join(', ')}]
          </Text>
        </>
      )}
    </Box>
  );
};
