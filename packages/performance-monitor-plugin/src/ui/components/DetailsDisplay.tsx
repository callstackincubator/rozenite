import { Box, Text, Heading } from '@radix-ui/themes';
import { ReactNode } from 'react';
import { JsonTree } from './JsonTree';

export type DetailsDisplayProps = {
  details?: unknown;
};

export const DetailsDisplay = ({ details }: DetailsDisplayProps) => {
  const renderValue = (value: unknown): ReactNode => {
    if (value == null) {
      return <Text color="gray">No details provided</Text>;
    }

    return <JsonTree data={details} />;
  };

  return (
    <Box>
      <Heading size="3" mb="3">
        Details
      </Heading>
      <Box>{renderValue(details)}</Box>
    </Box>
  );
};
