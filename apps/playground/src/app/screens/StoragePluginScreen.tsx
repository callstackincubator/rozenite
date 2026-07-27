import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';
import { initializeMMKVStorages, mmkvStorages } from '../mmkv-storages';
import {
  asyncStorageV2,
  asyncStorageV3Instances,
  forgetSecureStoreKey,
  getKnownSecureStoreKeys,
  rememberSecureStoreKey,
} from '../storage-plugin-adapters';

type AdapterTab = 'mmkv' | 'async' | 'secure';
type AsyncStorageMode = 'v2-default' | 'v3-auth' | 'v3-cache';
type EntryType = 'string' | 'number' | 'boolean' | 'buffer';
type AsyncStorageLike = {
  getAllKeys: () => Promise<string[]>;
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

type Entry = {
  key: string;
  value: string;
  type: EntryType;
};

const mmkvIds = Object.keys(mmkvStorages) as Array<keyof typeof mmkvStorages>;

const parseMMKVEntry = (storage: MMKV, key: string): Entry | null => {
  const stringValue = storage.getString(key);
  if (stringValue !== undefined) {
    return { key, type: 'string', value: stringValue };
  }

  const numberValue = storage.getNumber(key);
  if (numberValue !== undefined) {
    return { key, type: 'number', value: String(numberValue) };
  }

  const booleanValue = storage.getBoolean(key);
  if (booleanValue !== undefined) {
    return { key, type: 'boolean', value: String(booleanValue) };
  }

  const bufferValue = storage.getBuffer(key);
  if (bufferValue !== undefined) {
    return {
      key,
      type: 'buffer',
      value: JSON.stringify(Array.from(new Uint8Array(bufferValue))),
    };
  }

  return null;
};

export const StoragePluginScreen = () => {
  const [tab, setTab] = useState<AdapterTab>('mmkv');
  const [asyncStorageMode, setAsyncStorageMode] =
    useState<AsyncStorageMode>('v2-default');
  const [mmkvStorageId, setMmkvStorageId] = useState<keyof typeof mmkvStorages>('user-storage');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [entryType, setEntryType] = useState<EntryType>('string');
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    initializeMMKVStorages();
  }, []);

  const supportsTypedValues = tab === 'mmkv';

  const title = useMemo(() => {
    if (tab === 'mmkv') {
      return 'MMKV Adapter';
    }

    if (tab === 'async') {
      return 'AsyncStorage Adapter';
    }

    return 'SecureStore Adapter';
  }, [tab]);

  const selectedAsyncStorage: AsyncStorageLike = useMemo(() => {
    if (asyncStorageMode === 'v3-auth') {
      return asyncStorageV3Instances.auth;
    }

    if (asyncStorageMode === 'v3-cache') {
      return asyncStorageV3Instances.cache;
    }

    return asyncStorageV2;
  }, [asyncStorageMode]);

  const loadEntries = async () => {
    if (tab === 'mmkv') {
      const storage = mmkvStorages[mmkvStorageId];
      const nextEntries = storage
        .getAllKeys()
        .map((entryKey) => parseMMKVEntry(storage, entryKey))
        .filter((item): item is Entry => !!item);
      setEntries(nextEntries);
      return;
    }

    if (tab === 'async') {
      const keys = await selectedAsyncStorage.getAllKeys();
      const values = await Promise.all(
        keys.map(async (entryKey) => [
          entryKey,
          await selectedAsyncStorage.getItem(entryKey),
        ] as const)
      );
      setEntries(
        values.map(([entryKey, entryValue]) => ({
          key: entryKey,
          type: 'string',
          value: entryValue ?? '',
        }))
      );
      return;
    }

    const keys = getKnownSecureStoreKeys();
    const values = await Promise.all(
      keys.map(async (entryKey) => ({
        key: entryKey,
        value: (await SecureStore.getItemAsync(entryKey)) ?? '',
      }))
    );

    setEntries(
      values
        .filter((item) => item.value !== '')
        .map((item) => ({
          key: item.key,
          type: 'string',
          value: item.value,
        }))
    );
  };

  useEffect(() => {
    void loadEntries();
  }, [tab, mmkvStorageId, asyncStorageMode]);

  const handleSet = async () => {
    if (!key.trim()) {
      return;
    }

    try {
      if (tab === 'mmkv') {
        const storage = mmkvStorages[mmkvStorageId];
        if (entryType === 'string') {
          storage.set(key, value);
        } else if (entryType === 'number') {
          const parsed = Number(value);
          if (Number.isNaN(parsed)) {
            throw new Error('Invalid number value');
          }
          storage.set(key, parsed);
        } else if (entryType === 'boolean') {
          if (value !== 'true' && value !== 'false') {
            throw new Error('Boolean value must be true or false');
          }
          storage.set(key, value === 'true');
        } else {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'number')) {
            throw new Error('Buffer value must be a JSON array of numbers');
          }
          storage.set(key, new Uint8Array(parsed).buffer);
        }
      } else if (tab === 'async') {
        await selectedAsyncStorage.setItem(key, value);
      } else {
        rememberSecureStoreKey(key);
        await SecureStore.setItemAsync(key, value);
      }

      setValue('');
      await loadEntries();
    } catch (error) {
      Alert.alert('Set failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleDelete = async () => {
    if (!key.trim()) {
      return;
    }

    if (tab === 'mmkv') {
      const storage = mmkvStorages[mmkvStorageId] as unknown as {
        delete?: (entryKey: string) => void;
        remove?: (entryKey: string) => void;
      };
      if (typeof storage.remove === 'function') {
        storage.remove(key);
      } else {
        storage.delete?.(key);
      }
    } else if (tab === 'async') {
      await selectedAsyncStorage.removeItem(key);
    } else {
      forgetSecureStoreKey(key);
      await SecureStore.deleteItemAsync(key);
    }

    setValue('');
    await loadEntries();
  };

  const handleSelectEntry = (entry: Entry) => {
    setKey(entry.key);
    setValue(entry.value);

    if (supportsTypedValues) {
      setEntryType(entry.type);
    } else {
      setEntryType('string');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Storage Plugin Testbed</Text>
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'mmkv' && styles.tabButtonActive]}
          onPress={() => setTab('mmkv')}
        >
          <Text style={styles.tabButtonText}>MMKV</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'async' && styles.tabButtonActive]}
          onPress={() => setTab('async')}
        >
          <Text style={styles.tabButtonText}>Async</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'secure' && styles.tabButtonActive]}
          onPress={() => setTab('secure')}
        >
          <Text style={styles.tabButtonText}>Secure</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>{title}</Text>

      {tab === 'mmkv' && (
        <View style={styles.inlineRow}>
          {mmkvIds.map((id) => (
            <TouchableOpacity
              key={id}
              style={[
                styles.storageChip,
                mmkvStorageId === id && styles.storageChipActive,
              ]}
              onPress={() => setMmkvStorageId(id)}
            >
              <Text style={styles.storageChipText}>{id}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {tab === 'async' && (
        <View style={styles.inlineRow}>
          <TouchableOpacity
            style={[
              styles.storageChip,
              asyncStorageMode === 'v2-default' && styles.storageChipActive,
            ]}
            onPress={() => setAsyncStorageMode('v2-default')}
          >
            <Text style={styles.storageChipText}>v2 default</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.storageChip,
              asyncStorageMode === 'v3-auth' && styles.storageChipActive,
            ]}
            onPress={() => setAsyncStorageMode('v3-auth')}
          >
            <Text style={styles.storageChipText}>v3 auth</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.storageChip,
              asyncStorageMode === 'v3-cache' && styles.storageChipActive,
            ]}
            onPress={() => setAsyncStorageMode('v3-cache')}
          >
            <Text style={styles.storageChipText}>v3 cache</Text>
          </TouchableOpacity>
        </View>
      )}

      <TextInput
        value={key}
        onChangeText={setKey}
        placeholder="Key"
        placeholderTextColor="#6b7280"
        style={styles.input}
      />

      <View style={styles.inlineRow}>
        {(['string', 'number', 'boolean', 'buffer'] as EntryType[]).map((type) => {
          const disabled = !supportsTypedValues && type !== 'string';
          return (
            <TouchableOpacity
              key={type}
              disabled={disabled}
              onPress={() => setEntryType(type)}
              style={[
                styles.typeChip,
                entryType === type && styles.typeChipActive,
                disabled && styles.typeChipDisabled,
              ]}
            >
              <Text style={styles.typeChipText}>{type}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!supportsTypedValues && (
        <Text style={styles.note}>
          AsyncStorage and SecureStore are string-only adapters in this demo.
        </Text>
      )}

      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={
          entryType === 'buffer'
            ? 'JSON buffer, e.g. [1,2,3]'
            : 'Value'
        }
        placeholderTextColor="#6b7280"
        style={styles.input}
      />

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={() => void handleSet()}>
          <Text style={styles.actionButtonText}>Set</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => void handleDelete()}
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => void loadEntries()}>
          <Text style={styles.actionButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => `${item.key}:${item.type}`}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.entryRow}
            onPress={() => handleSelectEntry(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.entryKey}>{item.key}</Text>
            <Text style={styles.entryType}>{item.type}</Text>
            <Text numberOfLines={1} style={styles.entryValue}>
              {item.value}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyState}>No entries</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1f2937',
  },
  tabButtonActive: {
    backgroundColor: '#8232FF',
  },
  tabButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  sectionTitle: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '600',
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  storageChip: {
    backgroundColor: '#1f2937',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  storageChipActive: {
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#8232FF',
  },
  storageChipText: {
    color: '#e5e7eb',
    fontSize: 12,
  },
  typeChip: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  typeChipActive: {
    backgroundColor: '#8232FF',
  },
  typeChipDisabled: {
    opacity: 0.45,
  },
  typeChipText: {
    color: '#f9fafb',
    fontSize: 12,
  },
  note: {
    color: '#fbbf24',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 10,
  },
  deleteButton: {
    backgroundColor: '#dc2626',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  entryRow: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    gap: 4,
  },
  entryKey: {
    color: '#f9fafb',
    fontWeight: '700',
  },
  entryType: {
    color: '#a78bfa',
    fontSize: 12,
  },
  entryValue: {
    color: '#93c5fd',
  },
  emptyState: {
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 24,
  },
});
