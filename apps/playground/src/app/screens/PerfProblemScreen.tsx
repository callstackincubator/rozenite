import { FlatList, Text } from 'react-native';
import { ListItem, PluginHeader, Screen } from '../components/ui';
import { useTheme } from '../theme/useTheme';

const ITEM_COUNT = 16;
const BLOCK_TIME_MS = 200;

const burnCpu = (durationMs: number) => {
  const start = Date.now();
  let value = 0;

  while (Date.now() - start < durationMs) {
    value += Math.sqrt(value + 1);
  }

  return value;
};

type PerfItemProps = {
  index: number;
};

const PerfItem = ({ index }: PerfItemProps) => {
  const startedAt = Date.now();
  burnCpu(BLOCK_TIME_MS);
  const renderDuration = Date.now() - startedAt;

  return (
    <ListItem
      label={`Heavy item ${index + 1}`}
      description={`Render blocked JS thread for ${renderDuration}ms`}
    />
  );
};

export const PerfProblemScreen = () => {
  const { theme } = useTheme();
  const items = Array.from({ length: ITEM_COUNT }, (_, index) => index);

  return (
    <Screen scroll={false}>
      <PluginHeader
        title="Perf Problem"
        subtitle="Renders 16 items that each block the JS thread for 200ms."
      />
      <FlatList
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(item) => item.toString()}
        renderItem={({ item }) => <PerfItem index={item} />}
      />
      <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSize.xs }}>
        Watch frame drops in the Performance Monitor DevTools while this list renders.
      </Text>
    </Screen>
  );
};
