import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';

type ScreenEdge = 'top' | 'bottom';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  edges?: ScreenEdge[];
};

export const Screen = ({
  children,
  scroll = true,
  style,
  contentContainerStyle,
  edges = ['top', 'bottom'],
}: ScreenProps) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const containerStyle = [styles.container, { backgroundColor: theme.colors.background }, style];

  const content = [
    styles.content,
    {
      paddingTop: theme.spacing['2xl'] + (edges.includes('top') ? insets.top : 0),
      paddingBottom: theme.spacing['2xl'] + (edges.includes('bottom') ? insets.bottom : 0),
      paddingHorizontal: theme.spacing['2xl'],
      gap: theme.spacing.lg,
    },
    contentContainerStyle,
  ];

  if (!scroll) {
    return <View style={[...containerStyle, ...content]}>{children}</View>;
  }

  return (
    <ScrollView
      style={containerStyle}
      contentContainerStyle={content}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
});
