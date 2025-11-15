import { AppRegistry } from 'react-native';
import App from './app/App';

import 'react-native-get-random-values';

// Import the queued interceptor early to start capturing requests from boot
import '@rozenite/network-activity-plugin/react-native';

const getUsers = async (): Promise<unknown> => {
  const response = await fetch('https://jsonplaceholder.typicode.com/users', {
    headers: {
      'X-Rozenite-Test': 'true',
      Cookie: 'sessionid=abc123; theme=dark; user=testuser',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

console.log('Fetching users for testing network inspector...');
getUsers().finally(() => {
  console.log('Fetch users request completed.');
});

AppRegistry.registerComponent('Playground', () => App);
