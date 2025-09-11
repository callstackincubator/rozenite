import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '../navigation/types';

export const HomeTabScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  const handleNavigateToParameter = () => {
    navigation.navigate('ParameterDisplay', {
      title: 'Welcome Home!',
      message:
        'This message was sent from the Home tab. You can pass any data through navigation parameters and display it on the target screen.',
      color: '#FF6B6B',
      source: 'Home Tab',
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Home Tab</Text>
      <Text style={styles.subtext}>This is the home tab screen</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handleNavigateToParameter}
      >
        <Text style={styles.buttonText}>Show Parameter Screen</Text>
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
