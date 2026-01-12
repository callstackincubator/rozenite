import { Box, Text, Heading, Separator, Flex } from '@radix-ui/themes';
import { SerializedPerformanceMeasure } from '../../shared/types';
import { DetailsDisplay } from './DetailsDisplay';
import { formatTime, formatDuration } from '../utils';

export type MeasureDetailsProps = {
  measure: SerializedPerformanceMeasure;
};

export const MeasureDetails = ({ measure }: MeasureDetailsProps) => {
  const endTime = measure.startTime + measure.duration;

  return (
    <Box>
      <Heading size="5" mb="4">
        Measure Details
      </Heading>

      <Box mb="4">
        <Flex align="center" gap="3">
          <Text size="2" color="gray" style={{ minWidth: '80px' }}>
            Name:
          </Text>
          <Text weight="medium" size="3">
            {measure.name}
          </Text>
        </Flex>
      </Box>

      <Box mb="4">
        <Flex align="center" gap="3">
          <Text size="2" color="gray" style={{ minWidth: '80px' }}>
            Duration:
          </Text>
          <Text color="blue" weight="medium" size="3">
            {formatDuration(measure.duration)}
          </Text>
        </Flex>
      </Box>

      <Box mb="4">
        <Flex align="center" gap="3">
          <Text size="2" color="gray" style={{ minWidth: '80px' }}>
            Start Time:
          </Text>
          <Text size="3">{formatTime(measure.startTime)}</Text>
        </Flex>
      </Box>

      <Box mb="4">
        <Flex align="center" gap="3">
          <Text size="2" color="gray" style={{ minWidth: '80px' }}>
            End Time:
          </Text>
          <Text size="3">{formatTime(endTime)}</Text>
        </Flex>
      </Box>

      <Separator size="4" my="4" />

      <DetailsDisplay details={measure.detail} />
    </Box>
  );
};
