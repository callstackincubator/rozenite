import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface StorageItem {
  key: string;
  value: string;
}

export const AsyncStoragePluginScreen = () => {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  // Add sample data on first load
  useEffect(() => {
    const addInitialData = async () => {
      try {
        // Check if data already exists
        const keys = await AsyncStorage.getAllKeys();
        if (keys.length === 0) {
          // Add demo data
          await AsyncStorage.setItem('username', 'john_doe');
          await AsyncStorage.setItem('email', 'john@example.com');
          await AsyncStorage.setItem('user_id', '12345');
          await AsyncStorage.setItem('is_premium', 'true');
          await AsyncStorage.setItem('last_login', Date.now().toString());
          await AsyncStorage.setItem('profile', JSON.stringify({ 
            bio: 'Software Developer',
            location: 'San Francisco' 
          }));
          await AsyncStorage.setItem('app_settings', JSON.stringify({
            theme: 'dark',
            notifications: true,
            language: 'en'
          }));
          console.log('AsyncStorage initial data added');
        }
      } catch (error) {
        console.error('Failed to add initial AsyncStorage data:', error);
      } finally {
        // Load data regardless of whether initial data was added
        loadData();
      }
    };

    addInitialData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const result = await AsyncStorage.multiGet(keys);
      
      const storageItems = result
        .filter((item): item is [string, string] => item[1] !== null)
        .map(([key, value]: [string, string]) => ({ key, value }));
      
      setItems(storageItems);
    } catch (error) {
      console.error('Failed to load AsyncStorage data:', error);
      Alert.alert('Error', 'Failed to load storage data');
    } finally {
      setLoading(false);
    }
  };

  const addItem = async () => {
    if (!key || !value) {
      Alert.alert('Error', 'Both key and value are required');
      return;
    }

    try {
      await AsyncStorage.setItem(key, value);
      setKey('');
      setValue('');
      loadData();
      Alert.alert('Success', 'Item added successfully');
    } catch (error) {
      console.error('Failed to add item:', error);
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const removeItem = async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
      loadData();
    } catch (error) {
      console.error('Failed to remove item:', error);
      Alert.alert('Error', 'Failed to remove item');
    }
  };

  const clearAll = async () => {
    try {
      await AsyncStorage.clear();
      loadData();
      Alert.alert('Success', 'All items cleared');
    } catch (error) {
      console.error('Failed to clear storage:', error);
      Alert.alert('Error', 'Failed to clear storage');
    }
  };

  // Helper function to detect value type
  const detectValueType = (value: string): string => {
    try {
      // Try to parse JSON
      if (value === 'true' || value === 'false') {
        return 'boolean';
      }
      
      const num = Number(value);
      if (!isNaN(num) && value !== '') {
        return 'number';
      }
      
      // Check if it's valid JSON (object or array)
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return 'array';
      }
      if (parsed && typeof parsed === 'object') {
        return 'object';
      }
      
      return 'string';
    } catch {
      return 'string';
    }
  };

  const renderItem = ({ item }: { item: StorageItem }) => {
    // Determine the entry type
    const type = detectValueType(item.value);
    
    // Format the display value
    let displayValue = item.value;
    if (type === 'object' || type === 'array') {
      try {
        displayValue = JSON.stringify(JSON.parse(item.value), null, 2).substring(0, 100);
        if (displayValue.length >= 100) displayValue += '...';
      } catch {
        // Keep original value if parsing fails
      }
    }
    
    return (
      <View style={styles.item}>
        <View style={styles.itemHeader}>
          <Text style={styles.key}>{item.key}</Text>
          <View style={[
            styles.entryType,
            type === 'string' ? styles.stringType :
            type === 'number' ? styles.numberType :
            type === 'boolean' ? styles.booleanType :
            type === 'array' ? styles.arrayType : styles.objectType
          ]}>
            <Text style={styles.entryTypeText}>{type}</Text>
          </View>
        </View>
        
        <View style={styles.itemContent}>
          <Text style={styles.value} numberOfLines={10} ellipsizeMode="tail">
            {displayValue}
          </Text>
          
          <View style={styles.itemFooter}>
            <View style={styles.spacer} />
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => removeItem(item.key)}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AsyncStorage Explorer</Text>
        <Text style={styles.subtitle}>Inspect and manage your persistent data</Text>
      </View>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Key"
          placeholderTextColor="#666666"
          value={key}
          onChangeText={setKey}
        />
        <TextInput
          style={styles.input}
          placeholder="Value"
          placeholderTextColor="#666666"
          value={value}
          onChangeText={setValue}
        />
        <TouchableOpacity style={styles.addButton} onPress={addItem}>
          <Text style={styles.buttonText}>Add Item</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentHeader}>
        <Text style={styles.contentTitle}>
          Storage Entries ({items.length})
        </Text>
        <View style={styles.contentActions}>
          <TouchableOpacity style={styles.button} onPress={loadData}>
            <Text style={styles.buttonText}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={clearAll}>
            <Text style={styles.buttonText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading storage entries...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No items in storage
          </Text>
          <Text style={styles.emptyStateSubtext}>
            Tap "Add Item" or "Add Sample Data" to create entries
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContainer}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    fontWeight: '400',
  },
  contentHeader: {
    gap: 8,
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  contentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  contentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    color: '#ffffff',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#52c41a',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingVertical: 10,
  },
  item: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: '#333333',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemContent: {
    flex: 1,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  spacer: {
    flex: 1,
  },
  entryType: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    minWidth: 50,
    alignItems: 'center',
    marginLeft: 8,
  },
  stringType: {
    backgroundColor: '#007AFF', // blue
  },
  numberType: {
    backgroundColor: '#32CD32', // green
  },
  booleanType: {
    backgroundColor: '#FF7F00', // orange
  },
  objectType: {
    backgroundColor: '#9932CC', // purple
  },
  arrayType: {
    backgroundColor: '#DC143C', // crimson
  },
  entryTypeText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  entryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginLeft: 8,
  },
  key: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 4,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  separator: {
    height: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#a0a0a0',
    marginTop: 16,
    fontSize: 16,
  },
});
