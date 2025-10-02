import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SuccessiveScreensNavigationProp } from '../navigation/SuccessiveScreensNavigator';

export const SuccessiveScreens = () => {
  const navigation = useNavigation<SuccessiveScreensNavigationProp>();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Successive Screens</Text>
      <Text style={styles.subtext}>
        Successive screens to be stacked one on top of the other
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          navigation.push('SuccessiveScreens');
        }}
      >
        <Text style={styles.buttonText}>Push a new screen</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF6B6B', // Red color
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 16,
    color: 'white',
    opacity: 0.8,
    marginBottom: 32,
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
