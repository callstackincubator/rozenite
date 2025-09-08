import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '../navigation/types';

export const ProfileTabScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  const handleNavigateToParameter = () => {
    navigation.navigate('ParameterDisplay', {
      title: 'User Profile Data',
      message:
        'This is profile information passed as parameters. In a real app, this could be user details, preferences, or any profile-related data.',
      color: '#4ECDC4',
      source: 'Profile Tab',
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Profile Tab</Text>
      <Text style={styles.subtext}>This is the profile tab screen</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handleNavigateToParameter}
      >
        <Text style={styles.buttonText}>View Profile Details</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4ECDC4', // Teal color
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
