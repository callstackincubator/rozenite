import { ScrollArea, Box, Button, Flex } from '@radix-ui/themes';
import { Cross2Icon } from '@radix-ui/react-icons';
import { MeasureDetails } from './MeasureDetails';
import { MetricDetails } from './MetricDetails';
import { MarkDetails } from './MarkDetails';
import { SerializedPerformanceEntry } from '../../shared/types';

export type DetailsSidebarProps = {
  selectedItem: SerializedPerformanceEntry | null;
  onClose: () => void;
};

export const DetailsSidebar = ({
  selectedItem,
  onClose,
}: DetailsSidebarProps) => {
  const renderDetails = () => {
    if (!selectedItem) return null;

    switch (selectedItem.entryType) {
      case 'measure':
        return <MeasureDetails measure={selectedItem} />;
      case 'metric':
        return <MetricDetails metric={selectedItem} />;
      case 'mark':
        return <MarkDetails mark={selectedItem} />;
      default:
        return null;
    }
  };

  if (!selectedItem) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <Box
        position="fixed"
        top="0"
        left="0"
        right="0"
        bottom="0"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
        }}
        onClick={onClose}
      />

      {/* Sidebar */}
      <Box
        position="fixed"
        top="0"
        right="0"
        minWidth="400px"
        maxWidth="50vw"
        height="100vh"
        style={{
          backgroundColor: '#1a1a1a',
          borderLeft: '1px solid #333333',
          zIndex: 1000,
          boxShadow: '-4px 0 8px rgba(0, 0, 0, 0.3)',
        }}
      >
        <Flex p="4" direction="column" height="100vh">
          <Flex justify="between" align="center" mb="4">
            <Box />
            <Button
              variant="ghost"
              size="2"
              onClick={onClose}
              style={{ padding: '4px' }}
            >
              <Cross2Icon width="16" height="16" />
            </Button>
          </Flex>

          <ScrollArea style={{ flex: 1 }}>
            <Box pr="4">{renderDetails()}</Box>
          </ScrollArea>
        </Flex>
      </Box>
    </>
  );
};
