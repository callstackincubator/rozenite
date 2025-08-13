import { Box, Text, Heading, Separator, Flex } from '@radix-ui/themes';
import { SerializedPerformanceMetric } from '../../shared/types';
import { DetailsDisplay } from './DetailsDisplay';

export type MetricDetailsProps = {
  metric: SerializedPerformanceMetric;
};

export const MetricDetails = ({ metric }: MetricDetailsProps) => {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Box>
      <Heading size="5" mb="4">
        Metric Details
      </Heading>

      <Box mb="4">
        <Flex align="center" gap="3">
          <Text size="2" color="gray" style={{ minWidth: '80px' }}>
            Name:
          </Text>
          <Text weight="medium" size="3">
            {metric.name}
          </Text>
        </Flex>
      </Box>

      <Box mb="4">
        <Flex align="center" gap="3">
          <Text size="2" color="gray" style={{ minWidth: '80px' }}>
            Value:
          </Text>
          <Text color="green" weight="medium" size="3">
            {String(metric.value)}
          </Text>
        </Flex>
      </Box>

      <Box mb="4">
        <Flex align="center" gap="3">
          <Text size="2" color="gray" style={{ minWidth: '80px' }}>
            Recorded at:
          </Text>
          <Text size="3">{formatTime(metric.startTime)}</Text>
        </Flex>
      </Box>

      <Separator size="4" my="4" />

      <DetailsDisplay details={metric.detail} />
    </Box>
  );
};
