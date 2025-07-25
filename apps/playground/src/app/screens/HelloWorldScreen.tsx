import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

// Types for the API response
interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  website: string;
}

// Type for creating a new user
interface CreateUserData {
  name: string;
  username: string;
  email: string;
  phone: string;
  website: string;
}

// API function to fetch users
const fetchUsers = async (): Promise<User[]> => {
  // Add a random seed to make the response different each time
  const randomSeed = Math.random();
  const response = await fetch(
    `https://jsonplaceholder.typicode.com/users?_seed=${randomSeed}`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }
  const users = await response.json();

  // Shuffle the users array to make it random on each fetch
  return users.sort(() => Math.random() - 0.5);
};

// API function to create a new user
const createUser = async (userData: CreateUserData): Promise<User> => {
  const response = await fetch('https://jsonplaceholder.typicode.com/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    throw new Error('Failed to create user');
  }

  return response.json();
};

export const HelloWorldScreen = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreateUserData>({
    name: '',
    username: '',
    email: '',
    phone: '',
    website: '',
  });

  // TanStack Query to fetch users
  const {
    data: users,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 5,
  });

  // TanStack Query mutation to create a new user
  const createUserMutation = useMutation({
    mutationKey: ['createUser'],
    mutationFn: createUser,
    onSuccess: (newUser) => {
      // Invalidate and refetch users query to show the new user
      queryClient.invalidateQueries({ queryKey: ['users'] });

      // Reset form
      setFormData({
        name: '',
        username: '',
        email: '',
        phone: '',
        website: '',
      });
      setShowForm(false);

      Alert.alert('Success', `User "${newUser.name}" created successfully!`);
    },
    onError: () => {
      Alert.alert('Error', 'Failed to create user. Please try again.');
    },
  });

  const handleCreateUser = () => {
    // Basic validation
    if (!formData.name || !formData.email) {
      Alert.alert('Validation Error', 'Name and email are required');
      return;
    }

    createUserMutation.mutate(formData);
  };

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.userCard}>
      <Text style={styles.userName}>{item.name}</Text>
      <Text style={styles.userEmail}>{item.email}</Text>
      <Text style={styles.userPhone}>{item.phone}</Text>
      <Text style={styles.userWebsite}>{item.website}</Text>
    </View>
  );

  const renderForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.formTitle}>Add New User</Text>

      <TextInput
        style={styles.input}
        placeholder="Name"
        placeholderTextColor="#666"
        value={formData.name}
        onChangeText={(text) =>
          setFormData((prev) => ({ ...prev, name: text }))
        }
      />

      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor="#666"
        value={formData.username}
        onChangeText={(text) =>
          setFormData((prev) => ({ ...prev, username: text }))
        }
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#666"
        value={formData.email}
        onChangeText={(text) =>
          setFormData((prev) => ({ ...prev, email: text }))
        }
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Phone"
        placeholderTextColor="#666"
        value={formData.phone}
        onChangeText={(text) =>
          setFormData((prev) => ({ ...prev, phone: text }))
        }
        keyboardType="phone-pad"
      />

      <TextInput
        style={styles.input}
        placeholder="Website"
        placeholderTextColor="#666"
        value={formData.website}
        onChangeText={(text) =>
          setFormData((prev) => ({ ...prev, website: text }))
        }
        autoCapitalize="none"
      />

      <View style={styles.formButtons}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => setShowForm(false)}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.createButton]}
          onPress={handleCreateUser}
          disabled={createUserMutation.isPending}
        >
          {createUserMutation.isPending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Create User</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>People Data</Text>
        <Text style={styles.subtitle}>Fetched with TanStack Query</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.button} onPress={() => refetch()}>
            <Text style={styles.buttonText}>Refetch</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.addButton]}
            onPress={() => setShowForm(!showForm)}
          >
            <Text style={styles.buttonText}>
              {showForm ? 'Cancel' : 'Add User'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {showForm && renderForm()}

      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading people data...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error loading data</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => refetch()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={users}
            renderItem={renderUser}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    fontWeight: '400',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButton: {
    backgroundColor: '#52c41a',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444444',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 12,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    backgroundColor: '#666666',
    flex: 1,
  },
  createButton: {
    backgroundColor: '#52c41a',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#a0a0a0',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    paddingVertical: 10,
  },
  userCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 2,
  },
  userWebsite: {
    fontSize: 14,
    color: '#52c41a',
  },
  separator: {
    height: 12,
  },
});
