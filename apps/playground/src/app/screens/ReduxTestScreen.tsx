import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '../navigation/types';
import { decrement, increment, reset } from '../store/counterSlice';
import { primaryStore, secondaryStore, RootState } from '../store';

type CounterCardProps = {
  title: string;
};

const CounterCard = ({ title }: CounterCardProps) => {
  const dispatch = useDispatch();
  const count = useSelector((state: RootState) => state.counter.value);

  return (
    <View style={styles.counterCard}>
      <Text style={styles.counterTitle}>{title}</Text>
      <Text style={styles.counterValue}>{count}</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.decrementButton]}
          onPress={() => dispatch(decrement())}
        >
          <Text style={styles.buttonText}>-</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.incrementButton]}
          onPress={() => dispatch(increment())}
        >
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={() => dispatch(reset())}
        >
          <Text style={styles.buttonText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const ReduxTestScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Redux Multi-Store Test</Text>
      </View>

      <View style={styles.content}>
        <Provider store={primaryStore}>
          <CounterCard title="Primary Store Counter" />
        </Provider>

        <Provider store={secondaryStore}>
          <CounterCard title="Secondary Store Counter" />
        </Provider>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            This screen uses two independent Redux stores.
          </Text>
          <Text style={styles.infoText}>
            Open Redux DevTools and switch instances to inspect each store.
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
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  counterCard: {
    backgroundColor: '#141414',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2b2b2b',
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  counterTitle: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 10,
  },
  counterValue: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 6,
    minWidth: 56,
    alignItems: 'center',
  },
  decrementButton: {
    backgroundColor: '#FF3B30',
  },
  incrementButton: {
    backgroundColor: '#34C759',
  },
  resetButton: {
    backgroundColor: '#FF9500',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoContainer: {
    marginTop: 8,
    paddingHorizontal: 10,
  },
  infoText: {
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 6,
  },
});
