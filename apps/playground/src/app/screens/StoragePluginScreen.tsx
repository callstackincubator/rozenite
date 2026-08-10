import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';
import {
  Button,
  EmptyState,
  Field,
  Input,
  ListItem,
  PluginHeader,
  Row,
  Screen,
  SegmentedTabs,
} from '../components/ui';
import { initializeMMKVStorages, mmkvStorages } from '../mmkv-storages';
import {
  asyncStorageV2,
  asyncStorageV3Instances,
  forgetSecureStoreKey,
  getKnownSecureStoreKeys,
  rememberSecureStoreKey,
} from '../storage-plugin-adapters';
import { useTheme } from '../theme/useTheme';

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

const mmkvIds = Object.keys(mmkvStorages) as (keyof typeof mmkvStorages)[];

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
  const { theme } = useTheme();
  const [tab, setTab] = useState<AdapterTab>('mmkv');
  const [asyncStorageMode, setAsyncStorageMode] = useState<AsyncStorageMode>('v2-default');
  const [mmkvStorageId, setMmkvStorageId] = useState<keyof typeof mmkvStorages>('user-storage');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [entryType, setEntryType] = useState<EntryType>('string');
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    initializeMMKVStorages();
  }, []);

  const supportsTypedValues = tab === 'mmkv';

  const selectedAsyncStorage: AsyncStorageLike = useMemo(() => {
    if (asyncStorageMode === 'v3-auth') {
      return asyncStorageV3Instances.auth;
    }

    if (asyncStorageMode === 'v3-cache') {
      return asyncStorageV3Instances.cache;
    }

    return asyncStorageV2;
  }, [asyncStorageMode]);

  const loadEntries = useCallback(async () => {
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
        keys.map(
          async (entryKey) => [entryKey, await selectedAsyncStorage.getItem(entryKey)] as const,
        ),
      );
      setEntries(
        values.map(([entryKey, entryValue]) => ({
          key: entryKey,
          type: 'string',
          value: entryValue ?? '',
        })),
      );
      return;
    }

    const keys = getKnownSecureStoreKeys();
    const values = await Promise.all(
      keys.map(async (entryKey) => ({
        key: entryKey,
        value: (await SecureStore.getItemAsync(entryKey)) ?? '',
      })),
    );

    setEntries(
      values
        .filter((item) => item.value !== '')
        .map((item) => ({
          key: item.key,
          type: 'string',
          value: item.value,
        })),
    );
  }, [mmkvStorageId, selectedAsyncStorage, tab]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

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
    setEntryType(supportsTypedValues ? entry.type : 'string');
  };

  return (
    <Screen scroll={false}>
      <PluginHeader title="Storage" subtitle="MMKV, AsyncStorage, and SecureStore adapters." />

      <SegmentedTabs
        accessibilityLabel="Storage adapter"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'mmkv', label: 'MMKV' },
          { value: 'async', label: 'Async' },
          { value: 'secure', label: 'Secure' },
        ]}
      />

      {tab === 'mmkv' ? (
        <Row wrap>
          {mmkvIds.map((id) => (
            <Button
              key={id}
              label={id}
              size="compact"
              variant={mmkvStorageId === id ? 'default' : 'secondary'}
              onPress={() => setMmkvStorageId(id)}
            />
          ))}
        </Row>
      ) : null}

      {tab === 'async' ? (
        <Row wrap>
          {(
            [
              ['v2-default', 'v2 default'],
              ['v3-auth', 'v3 auth'],
              ['v3-cache', 'v3 cache'],
            ] as const
          ).map(([modeValue, label]) => (
            <Button
              key={modeValue}
              label={label}
              size="compact"
              variant={asyncStorageMode === modeValue ? 'default' : 'secondary'}
              onPress={() => setAsyncStorageMode(modeValue)}
            />
          ))}
        </Row>
      ) : null}

      <Field label="Key">
        <Input
          accessibilityLabel="Storage key"
          value={key}
          onChangeText={setKey}
          placeholder="Key"
        />
      </Field>

      <Row wrap>
        {(['string', 'number', 'boolean', 'buffer'] as EntryType[]).map((type) => (
          <Button
            key={type}
            label={type}
            size="compact"
            disabled={!supportsTypedValues && type !== 'string'}
            variant={entryType === type ? 'default' : 'secondary'}
            onPress={() => setEntryType(type)}
          />
        ))}
      </Row>

      <Field
        label="Value"
        helperText={
          !supportsTypedValues
            ? 'AsyncStorage and SecureStore are string-only in this demo.'
            : undefined
        }
      >
        <Input
          accessibilityLabel="Storage value"
          value={value}
          onChangeText={setValue}
          placeholder={entryType === 'buffer' ? 'JSON buffer, e.g. [1,2,3]' : 'Value'}
        />
      </Field>

      <Row wrap>
        <Button label="Set" onPress={() => void handleSet()} />
        <Button label="Delete" variant="destructive" onPress={() => void handleDelete()} />
        <Button label="Refresh" variant="secondary" onPress={() => void loadEntries()} />
      </Row>

      <FlatList
        style={{ flex: 1 }}
        data={entries}
        keyExtractor={(item) => `${item.key}:${item.type}`}
        renderItem={({ item }) => (
          <ListItem
            label={item.key}
            description={`${item.type} · ${item.value}`}
            accessibilityLabel={`Storage entry ${item.key}`}
            onPress={() => handleSelectEntry(item)}
          />
        )}
        ListEmptyComponent={<EmptyState title="No entries" />}
      />
      {entries.length === 0 ? null : (
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSize.xs }}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </Text>
      )}
    </Screen>
  );
};
