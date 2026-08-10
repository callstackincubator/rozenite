import { Alert } from 'react-native';
import { Button, Card, PluginHeader, Screen } from '../components/ui';

export const RequireProfilerTestScreen = () => {
  const handleRequireHeavyModule = () => {
    try {
      // Captured by the require profiler.
      require('./heavyComputationModule');
    } catch (error) {
      Alert.alert('Error', `Failed to require module: ${error}`);
    }
  };

  return (
    <Screen>
      <PluginHeader
        title="Require Profiler"
        subtitle="Require a heavy module and inspect its timing in DevTools."
      />
      <Card>
        <Button label="Require heavy computation module" onPress={handleRequireHeavyModule} />
      </Card>
    </Screen>
  );
};
