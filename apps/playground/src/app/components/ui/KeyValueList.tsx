import { View } from 'react-native';
import { List } from './List';
import { KeyValueRow } from './KeyValueRow';
import { useTheme } from '../../theme/useTheme';

type KeyValueListItem = {
  key?: string;
  label: string;
  value: string;
};

type KeyValueListProps = {
  title?: string;
  items: KeyValueListItem[];
};

export const KeyValueList = ({ title, items }: KeyValueListProps) => {
  const { theme } = useTheme();

  return (
    <List title={title}>
      {items.map((item) => (
        <View key={item.key ?? item.label} style={{ paddingHorizontal: theme.spacing['2xl'] }}>
          <KeyValueRow label={item.label} value={item.value} />
        </View>
      ))}
    </List>
  );
};
