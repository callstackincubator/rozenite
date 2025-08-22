import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { MMKV } from 'react-native-mmkv';
import {
  initializeMMKVStorages,
  userStorage,
  appSettings,
  cacheStorage,
} from '../mmkv-storages';

type MMKVEntryType = 'string' | 'number' | 'boolean' | 'buffer';

// Simplified interface - everything is stored as string
interface MMKVEntry {
  key: string;
  type: MMKVEntryType;
  value: string | number | boolean | object;
}

interface StorageData {
  id: string;
  name: string;
  entries: MMKVEntry[];
}

interface EditModalData {
  storageId: string;
  key: string;
  value: string;
  type: MMKVEntryType;
  isNew: boolean;
}

const looksLikeGarbled = (str: string): boolean => {
  // 1. Check for replacement character (�)
  if (str.includes('\uFFFD')) return true;

  // 2. Check for unusual control characters
  // eslint-disable-next-line no-control-regex
  const controlChars = /[\u0000-\u001F\u007F-\u009F]/;
  if (controlChars.test(str)) return true;

  // 3. Optionally, check if most chars are non-printable
  const printableRatio =
    [...str].filter((c) => c >= ' ' && c <= '~').length / str.length;
  if (printableRatio < 0.7) return true; // mostly non-printable → probably binary

  return false; // seems like valid string
};

const getMMKVEntry = (mmkv: MMKV, key: string): MMKVEntry => {
  const stringValue = mmkv.getString(key);

  if (stringValue !== undefined && stringValue.length > 0) {
    if (looksLikeGarbled(stringValue)) {
      // This is most-likely a buffer as it contains non-printable characters
      return {
        key,
        type: 'buffer',
        value: Array.from(new TextEncoder().encode(stringValue)),
      };
    }

    return {
      key,
      type: 'string',
      value: stringValue,
    };
  }

  const numberValue = mmkv.getNumber(key);
  if (numberValue !== undefined) {
    return {
      key,
      type: 'number',
      value: numberValue,
    };
  }

  const booleanValue = mmkv.getBoolean(key);
  if (booleanValue !== undefined) {
    return {
      key,
      type: 'boolean',
      value: booleanValue,
    };
  }

  const bufferValue = mmkv.getBuffer(key);
  if (bufferValue !== undefined) {
    return {
      key,
      type: 'buffer',
      value: Array.from(new Uint8Array(bufferValue)),
    };
  }

  throw new Error(`Unknown type for key: ${key}`);
};

// Map storage IDs to their instances for easier access
const storageInstances = {
  'user-storage': userStorage,
  'app-settings': appSettings,
  'cache-storage': cacheStorage,
} as const;

export const MMKVPluginScreen = () => {
  const [storages, setStorages] = useState<StorageData[]>([
    { id: 'user-storage', name: 'User Storage', entries: [] },
    { id: 'app-settings', name: 'App Settings', entries: [] },
    { id: 'cache-storage', name: 'Cache Storage', entries: [] },
  ]);
  const [selectedStorage, setSelectedStorage] =
    useState<string>('user-storage');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editData, setEditData] = useState<EditModalData>({
    storageId: '',
    key: '',
    value: '',
    type: 'string',
    isNew: false,
  });

  // Initialize MMKV instances with test data
  useEffect(() => {
    initializeMMKVStorages();
  }, []);

  // Get all entries from a storage using the actual instance
  const getStorageEntries = (storageId: string): MMKVEntry[] => {
    const instance =
      storageInstances[storageId as keyof typeof storageInstances];
    if (!instance) return [];

    const keys = instance.getAllKeys();
    return keys.map((key) => {
      return getMMKVEntry(instance, key);
    });
  };

  // Update entries for a specific storage
  const updateStorageEntries = (storageId: string) => {
    setStorages((prev) =>
      prev.map((storage) =>
        storage.id === storageId
          ? { ...storage, entries: getStorageEntries(storageId) }
          : storage
      )
    );
  };

  // Refresh all storages
  const refreshStorages = () => {
    setStorages((prev) =>
      prev.map((storage) => ({
        ...storage,
        entries: getStorageEntries(storage.id),
      }))
    );
  };

  // Load initial data
  useEffect(() => {
    refreshStorages();
  }, []);

  // Set up observers for each MMKV storage instance
  useEffect(() => {
    const listeners: Array<{ remove: () => void }> = [];

    // Set up listeners for each storage instance
    Object.entries(storageInstances).forEach(([storageId, instance]) => {
      const listener = instance.addOnValueChangedListener((changedKey) => {
        console.log(`MMKV ${storageId} changed - key: ${changedKey}`);
        // Update the cached entries for this specific storage
        updateStorageEntries(storageId);
      });

      listeners.push(listener);
    });

    // Cleanup function to remove all listeners
    return () => {
      listeners.forEach((listener) => listener.remove());
    };
  }, []);

  // Add new entry
  const addEntry = (
    storageId: string,
    key: string,
    value: string,
    type: MMKVEntryType
  ) => {
    const instance =
      storageInstances[storageId as keyof typeof storageInstances];
    if (!instance) {
      Alert.alert('Error', 'Failed to access storage');
      return;
    }

    // Validate key format (basic validation)
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      Alert.alert(
        'Error',
        'Key can only contain letters, numbers, underscores, and hyphens'
      );
      return;
    }

    try {
      switch (type) {
        case 'string':
          instance.set(key, value);
          break;
        case 'number': {
          const numValue = parseFloat(value);
          if (isNaN(numValue)) {
            Alert.alert(
              'Error',
              'Invalid number value. Please enter a valid number.'
            );
            return;
          }
          instance.set(key, numValue);
          break;
        }
        case 'boolean': {
          const lowerValue = value.toLowerCase();
          if (lowerValue !== 'true' && lowerValue !== 'false') {
            Alert.alert('Error', 'Boolean value must be "true" or "false"');
            return;
          }
          const boolValue = lowerValue === 'true';
          instance.set(key, boolValue);
          break;
        }
        case 'buffer': {
          let blob: ArrayBuffer;

          try {
            blob = new Uint8Array(JSON.parse(value)).buffer;
          } catch {
            Alert.alert(
              'Error',
              'Invalid buffer value. Please enter a valid buffer.'
            );
            return;
          }

          instance.set(key, blob);
          break;
        }
      }

      Alert.alert('Success', `Entry "${key}" added successfully`);
    } catch (error) {
      console.error('Error adding entry:', error);
      Alert.alert('Error', 'Failed to add entry. Please try again.');
    }
  };

  // Update existing entry
  const updateEntry = (
    storageId: string,
    key: string,
    value: string,
    type: MMKVEntryType
  ) => {
    const instance =
      storageInstances[storageId as keyof typeof storageInstances];
    if (!instance) {
      Alert.alert('Error', 'Failed to access storage');
      return;
    }

    addEntry(storageId, key, value, type); // Same logic as add
  };

  // Delete entry
  const deleteEntry = (storageId: string, key: string) => {
    Alert.alert('Confirm Delete', `Are you sure you want to delete "${key}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const instance =
            storageInstances[storageId as keyof typeof storageInstances];
          if (instance) {
            instance.delete(key);
            Alert.alert('Success', 'Entry deleted successfully');
          }
        },
      },
    ]);
  };

  // Open edit modal
  const openEditModal = (storageId: string, entry?: MMKVEntry) => {
    setEditData({
      storageId,
      key: entry?.key || '',
      value: entry
        ? Array.isArray(entry.value)
          ? JSON.stringify(entry.value)
          : String(entry.value)
        : '',
      type: entry?.type || 'string',
      isNew: !entry,
    });
    setEditModalVisible(true);
  };

  // Validate form data
  const validateForm = (): string | null => {
    const trimmedKey = editData.key.trim();

    if (!trimmedKey) {
      return 'Key cannot be empty';
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedKey)) {
      return 'Key can only contain letters, numbers, underscores, and hyphens';
    }

    if (editData.isNew) {
      const instance =
        storageInstances[editData.storageId as keyof typeof storageInstances];
      if (instance && instance.getAllKeys().includes(trimmedKey)) {
        return `Key "${trimmedKey}" already exists`;
      }
    }

    if (editData.type === 'number' && isNaN(parseFloat(editData.value))) {
      return 'Please enter a valid number';
    }

    if (editData.type === 'boolean') {
      const lowerValue = editData.value.toLowerCase();
      if (lowerValue !== 'true' && lowerValue !== 'false') {
        return 'Boolean value must be "true" or "false"';
      }
    }

    return null;
  };

  // Handle edit modal save
  const handleEditSave = () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }

    // Enhanced validation
    const trimmedKey = editData.key.trim();
    if (!trimmedKey) {
      Alert.alert('Error', 'Key cannot be empty');
      return;
    }

    if (editData.isNew) {
      addEntry(editData.storageId, trimmedKey, editData.value, editData.type);
    } else {
      updateEntry(
        editData.storageId,
        trimmedKey,
        editData.value,
        editData.type
      );
    }
    setEditModalVisible(false);
  };

  // Render storage entry
  const renderEntry = ({ item }: { item: MMKVEntry }) => (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryKey}>{item.key}</Text>
        <View style={styles.entryType}>
          <Text style={styles.entryTypeText}>{item.type}</Text>
        </View>
      </View>
      <Text style={styles.entryValue}>
        {typeof item.value === 'object'
          ? JSON.stringify(item.value)
          : String(item.value)}
      </Text>
      <View style={styles.entryActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(selectedStorage, item)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => deleteEntry(selectedStorage, item.key)}
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render storage tab
  const renderStorageTab = (storage: StorageData) => (
    <TouchableOpacity
      key={storage.id}
      style={[
        styles.storageTab,
        selectedStorage === storage.id && styles.selectedStorageTab,
      ]}
      onPress={() => setSelectedStorage(storage.id)}
    >
      <Text
        style={[
          styles.storageTabText,
          selectedStorage === storage.id && styles.selectedStorageTabText,
        ]}
      >
        {storage.name}
      </Text>
      <Text style={styles.storageCount}>{storage.entries.length} entries</Text>
    </TouchableOpacity>
  );

  const currentStorage = storages.find((s) => s.id === selectedStorage);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MMKV Storage Manager</Text>
        <Text style={styles.subtitle}>Manage your local storage instances</Text>
      </View>

      <View style={styles.storageTabs}>{storages.map(renderStorageTab)}</View>

      <View style={styles.content}>
        <View style={styles.contentHeader}>
          <Text style={styles.contentTitle}>
            {currentStorage?.name} ({currentStorage?.entries.length} entries)
          </Text>
          <View style={styles.contentActions}>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refreshStorages}
            >
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.addButton]}
              onPress={() => openEditModal(selectedStorage)}
            >
              <Text style={styles.buttonText}>Add Entry</Text>
            </TouchableOpacity>
          </View>
        </View>

        {currentStorage?.entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No entries in this storage
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Tap "Add Entry" to create your first entry
            </Text>
          </View>
        ) : (
          <FlatList
            data={currentStorage?.entries || []}
            renderItem={renderEntry}
            keyExtractor={(item) => `${selectedStorage}-${item.key}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editData.isNew ? 'Add New Entry' : 'Edit Entry'}
            </Text>

            {editData.isNew && (
              <Text style={styles.modalSubtitle}>
                Create a new key-value pair in{' '}
                {storages.find((s) => s.id === editData.storageId)?.name}
              </Text>
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="Enter key (letters, numbers, _, -)"
              placeholderTextColor="#666"
              value={editData.key}
              onChangeText={(text) =>
                setEditData((prev) => ({ ...prev, key: text }))
              }
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.typeSelector}>
              <Text style={styles.typeLabel}>Type:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(['string', 'number', 'boolean', 'buffer'] as const).map(
                  (type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeOption,
                        editData.type === type && styles.selectedTypeOption,
                      ]}
                      onPress={() => setEditData((prev) => ({ ...prev, type }))}
                    >
                      <Text
                        style={[
                          styles.typeOptionText,
                          editData.type === type &&
                            styles.selectedTypeOptionText,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </ScrollView>
            </View>

            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder={
                editData.type === 'string'
                  ? 'Enter text value'
                  : editData.type === 'number'
                  ? 'Enter number (e.g., 42, 3.14)'
                  : editData.type === 'boolean'
                  ? 'Enter true or false'
                  : 'Enter value'
              }
              placeholderTextColor="#666"
              value={editData.value}
              onChangeText={(text) =>
                setEditData((prev) => ({ ...prev, value: text }))
              }
              multiline={editData.type === 'string'}
              numberOfLines={editData.type === 'string' ? 4 : 1}
              keyboardType={editData.type === 'number' ? 'numeric' : 'default'}
              autoCapitalize={editData.type === 'string' ? 'sentences' : 'none'}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  (!editData.key.trim() || !editData.value.trim()) &&
                    styles.disabledButton,
                ]}
                onPress={handleEditSave}
                disabled={!editData.key.trim() || !editData.value.trim()}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    (!editData.key.trim() || !editData.value.trim()) &&
                      styles.disabledButtonText,
                  ]}
                >
                  {editData.isNew ? 'Add Entry' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  storageTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 8,
  },
  storageTab: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  selectedStorageTab: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  storageTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  selectedStorageTabText: {
    color: '#ffffff',
  },
  storageCount: {
    fontSize: 12,
    color: '#a0a0a0',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentHeader: {
    gap: 8,
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 20,
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
  refreshButton: {
    backgroundColor: '#666666',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButton: {
    backgroundColor: '#52c41a',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
  listContainer: {
    paddingVertical: 10,
  },
  entryCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryKey: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  entryType: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  entryTypeText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  entryValue: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  entryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#ff6b6b',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  separator: {
    height: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444444',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 16,
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    marginBottom: 16,
  },
  typeLabel: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
  },
  typeOption: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#444444',
  },
  selectedTypeOption: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeOptionText: {
    fontSize: 14,
    color: '#a0a0a0',
    fontWeight: '600',
  },
  selectedTypeOptionText: {
    color: '#ffffff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#666666',
  },
  saveButton: {
    backgroundColor: '#52c41a',
  },
  disabledButton: {
    backgroundColor: '#666666',
    opacity: 0.6,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#999999',
  },
});
