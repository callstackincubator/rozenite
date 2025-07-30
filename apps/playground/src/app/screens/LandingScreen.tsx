import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export const LandingScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.backgroundGradient}>
        <View style={styles.content}>
          <Text style={styles.mainTitle}>Rozenite</Text>
          <Text style={styles.subtitle}>
            React Native DevTools Plugin Framework{'\n'}
            Playground for testing plugins in real-world scenarios
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => navigation.navigate('MMKVPlugin' as never)}
            >
              <Text style={styles.buttonText}>MMKV Plugin</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => navigation.navigate('NetworkTest' as never)}
            >
              <Text style={styles.buttonText}>Network Activity</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => navigation.navigate('ReduxTest' as never)}
            >
              <Text style={styles.buttonText}>Redux Test</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.configButton}
              onPress={() => navigation.navigate('Config' as never)}
            >
              <Text style={styles.configButtonText}>⚙️ Settings</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            Test and explore Rozenite plugins with type-safe, isomorphic
            communication between DevTools and React Native
          </Text>
        </View>

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
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPath: {
    width: 48,
    height: 64,
    backgroundColor: '#8232FF',
    borderRadius: 2,
    // Create the distinctive shape using border radius
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  mainTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#8232FF',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 2,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: width * 0.9,
    fontWeight: '500',
    marginBottom: 48,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
    marginBottom: 32,
  },
  navigationButton: {
    backgroundColor: '#8232FF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#8232FF',
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
  configButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#8232FF',
  },
  configButtonText: {
    color: '#8232FF',
    fontSize: 16,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: width * 0.8,
    fontWeight: '400',
  },
  bottomAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#8232FF',
  },
});
