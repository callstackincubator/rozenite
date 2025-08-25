import { MMKV } from 'react-native-mmkv';

// Create MMKV instances with different storage IDs
export const userStorage = new MMKV({ id: 'user-storage' });
export const appSettings = new MMKV({ id: 'app-settings' });
export const cacheStorage = new MMKV({ id: 'cache-storage' });

// Array of all storages for dev tools
export const mmkvStorages = [userStorage, appSettings, cacheStorage];

// Initialize storage instances with test data
export const initializeMMKVStorages = () => {
  // Add test data to user storage
  userStorage.set('username', 'john_doe');
  userStorage.set('email', 'john@example.com');
  userStorage.set('age', 30);
  userStorage.set('isPremium', true);
  userStorage.set('lastLogin', Date.now());
  userStorage.set(
    'profile',
    JSON.stringify({ bio: 'Software Developer', location: 'San Francisco' })
  );

  // Add test data to app settings
  appSettings.set('theme', 'dark');
  appSettings.set('language', 'en');
  appSettings.set('notifications', true);
  appSettings.set('autoSave', false);
  appSettings.set('version', '1.0.0');
  appSettings.set('debugMode', false);
  appSettings.set('maxCacheSize', 100);
  appSettings.set(
    'buffer',
    new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).buffer
  );

  // Add test data to cache storage (including buffer)
  cacheStorage.set(
    'apiResponse',
    JSON.stringify({ data: 'cached response', timestamp: Date.now() })
  );
  cacheStorage.set(
    'userPreferences',
    JSON.stringify({ theme: 'dark', language: 'en' })
  );
  cacheStorage.set('timestamp', Date.now());
  cacheStorage.set('cacheSize', 1024);
  cacheStorage.set('lastSync', Date.now() - 3600000); // 1 hour ago

  // Add sensitive data in user storage
  userStorage.set('sensitiveToken', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
  userStorage.set('tempUserData', 'some temporary user data');

  console.log('MMKV test instances created with sample data');
};

// Helper function to get MMKV instance by ID
export const getMMKVInstance = (id: string): MMKV | null => {
  try {
    return new MMKV({ id });
  } catch (error) {
    console.error(`Failed to get MMKV instance for ${id}:`, error);
    return null;
  }
};
