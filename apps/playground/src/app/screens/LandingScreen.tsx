import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

export const LandingScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.backgroundGradient}>
        <View style={styles.content}>
          <Text style={styles.mainTitle}>Native World</Text>
          <Text style={styles.subtitle}>
            DevTools don't need to be limited {'\n'}to JS world only.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => navigation.navigate('HelloWorld' as never)}
            >
              <Text style={styles.buttonText}>Hello World</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => navigation.navigate('MMKVPlugin' as never)}
            >
              <Text style={styles.buttonText}>MMKV Plugin</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Floating decorative elements */}
        <View style={styles.floatingCircle1} />
        <View style={styles.floatingCircle2} />
        <View style={styles.floatingCircle3} />
        <View style={styles.bottomAccent} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    zIndex: 10,
  },
  mainTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 2,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 18,
    color: '#a0a0a0',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: width * 0.9,
    fontWeight: '400',
    marginBottom: 48,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 280,
    gap: 16,
  },
  navigationButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: '#333333',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  disabledButtonText: {
    color: '#666666',
  },
  floatingCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    top: height * 0.2,
    left: width * 0.1,
  },
  floatingCircle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    top: height * 0.7,
    right: width * 0.15,
  },
  floatingCircle3: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    top: height * 0.3,
    right: width * 0.2,
  },
  bottomAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#007AFF',
  },
});
