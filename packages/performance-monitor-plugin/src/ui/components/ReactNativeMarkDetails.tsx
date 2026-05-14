import { Box, Text, Heading, Separator, Flex } from '@radix-ui/themes';
import { SerializedPerformanceReactNativeMark } from '../../shared/types';
import { DetailsDisplay } from './DetailsDisplay';
import { formatTime } from '../utils';

export type ReactNativeMarkDetailsProps = {
  mark: SerializedPerformanceReactNativeMark;
};

export const ReactNativeMarkDetails = ({
  mark,
}: ReactNativeMarkDetailsProps) => {
  return (
    <Box>
      <Heading size="5" mb="4">
        React Native Mark Details
      </Heading>

      <Box mb="4">
        <Flex align="center" gap="3">
          <Text size="2" color="gray" style={{ minWidth: '80px' }}>
            Name:
          </Text>
          <Text weight="medium" size="3">
            {mark.name}
          </Text>
        </Flex>
      </Box>

      <Box mb="4">
        <Flex align="center" gap="3">
          <Text size="2" color="gray" style={{ minWidth: '80px' }}>
            Recorded at:
          </Text>
          <Text size="3">{formatTime(mark.startTime)}</Text>
        </Flex>
      </Box>

      <Separator size="4" my="4" />

      <DetailsDisplay details={mark.detail} />
    </Box>
  );
};
