import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Button, Card, KeyValueRow, Screen } from '../components/ui';
import { RootStackParamList } from '../navigation/types';

type ParameterDisplayRouteProp = RouteProp<RootStackParamList, 'ParameterDisplay'>;

export const ParameterDisplayScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<ParameterDisplayRouteProp>();
  const { title, message, source } = route.params;

  return (
    <Screen scroll={false}>
      <Card>
        <KeyValueRow label="Title" value={title} />
        <KeyValueRow label="Message" value={message} />
        <KeyValueRow label="Source" value={source} />
      </Card>
      <Button label="Go back" accessibilityLabel="Go back" onPress={() => navigation.goBack()} />
    </Screen>
  );
};
