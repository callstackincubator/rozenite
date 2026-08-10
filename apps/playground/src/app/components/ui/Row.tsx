import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';

type RowProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  align?: 'center' | 'flex-start' | 'flex-end';
  justify?: 'space-between' | 'flex-start' | 'flex-end' | 'center';
  wrap?: boolean;
};

export const Row = ({
  children,
  style,
  align = 'center',
  justify = 'space-between',
  wrap = false,
}: RowProps) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.row,
        {
          alignItems: align,
          justifyContent: justify,
          gap: theme.spacing.lg,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
});
