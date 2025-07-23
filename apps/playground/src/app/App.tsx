import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HelloWorldScreen } from './screens/HelloWorldScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTanStackQueryDevTools } from '@rozenite/tanstack-query-plugin';
import { useEffect } from 'react';
import { useNetworkActivityDevTools } from '@rozenite/network-activity-plugin';
import { MMKV } from 'react-native-mmkv';
import { useMMKVDevTools } from '@rozenite/mmkv-plugin';

const queryClient = new QueryClient();

const Wrapper = () => {
   useTanStackQueryDevTools();
   useNetworkActivityDevTools();

   // Create MMKV instances with test data
   useEffect(() => {
     // Create multiple MMKV instances with different data types
     const userStorage = new MMKV({ id: 'user-storage' });
     const appSettings = new MMKV({ id: 'app-settings' });
     const cacheStorage = new MMKV({ id: 'cache-storage' });

     // Add test data to user storage
     userStorage.set('username', 'john_doe');
     userStorage.set('email', 'john@example.com');
     userStorage.set('age', 30);
     userStorage.set('isPremium', true);
     userStorage.set('lastLogin', Date.now());

     // Add test data to app settings
     appSettings.set('theme', 'dark');
     appSettings.set('language', 'en');
     appSettings.set('notifications', true);
     appSettings.set('autoSave', false);
     appSettings.set('version', '1.0.0');

     // Add test data to cache storage (including buffer)
     cacheStorage.set('apiResponse', JSON.stringify({ data: 'cached response' }));
    //  cacheStorage.set('imageData', r.from('fake-image-data').toString('base64'));
     cacheStorage.set('timestamp', Date.now());
     cacheStorage.set('cacheSize', 1024);

     console.log('MMKV test instances created with sample data');
   }, []);

  //  useEffect(() => {
  //    const ref = setInterval(() => {
  //      // Test fetch with custom headers
  //      fetch('https://jsonplaceholder.typicode.com/posts/1', {
  //        method: 'GET',
  //        headers: {
  //          'Content-Type': 'application/json',
  //          'X-Custom-Header': 'test-value',
  //          'Authorization': 'Bearer test-token'
  //        }
  //      })
  //        .then(response => response.json())
  //        .then(json => {
  //          console.log('json', json);
  //          console.log('request done');
  //        })
  //        .catch(err => {
  //          console.error('error', err);
  //        });
  //    }, 5000);

  //    return () => clearInterval(ref);
  //  }, []);

   return (
    <HelloWorldScreen />
   )
}

export const App = () => {
  useMMKVDevTools();

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Wrapper />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
};

export default App;
