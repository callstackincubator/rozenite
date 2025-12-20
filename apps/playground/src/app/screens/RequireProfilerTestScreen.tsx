import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '../navigation/types';

export const RequireProfilerTestScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  const handleRequireHeavyModule = () => {
    try {
      // This require() call should be captured by the require profiler
      require('./heavyComputationModule');
      console.log('REQUIRED!');
    } catch (error) {
      Alert.alert('Error', `Failed to require module: ${error}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Require Profiler Test</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            This screen allows you to test the require profiler plugin by
            requiring a module that performs heavy computation.
          </Text>
          <Text style={styles.infoText}>
            The require() call and module execution should be captured and
            displayed in the Require Profiler DevTools.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.requireButton]}
            onPress={handleRequireHeavyModule}
          >
            <Text style={styles.buttonText}>
              Require Heavy Computation Module
            </Text>
            <Text style={styles.buttonSubtext}>
              Executes require() and runs 2-second computation
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>How it works:</Text>
          <Text style={styles.instructionsText}>
            • The button calls require() on a module that performs heavy
            computation
          </Text>
          <Text style={styles.instructionsText}>
            • The module contains a while loop that runs for exactly 2 seconds
          </Text>
          <Text style={styles.instructionsText}>
            • The require profiler should capture the require timing and
            execution
          </Text>
          <Text style={styles.instructionsText}>
            • Check the Require Profiler DevTools to see the captured metrics
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  infoContainer: {
    marginBottom: 30,
    padding: 15,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#8232FF',
  },
  infoText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 30,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  requireButton: {
    borderColor: '#8232FF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  buttonSubtext: {
    color: '#999',
    fontSize: 12,
  },
  instructionsContainer: {
    padding: 15,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  instructionsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  instructionsText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
});
