import { AppRegistry } from 'react-native';
import App from './app/App';

import 'react-native-get-random-values';

// Import the queued interceptor early to start capturing requests from boot
import '@rozenite/network-activity-plugin/react-native';
import { api } from './app/utils/network-activity/api';

// Make a fetch request during boot to test network inspector queuing
api.getUsers();

AppRegistry.registerComponent('Playground', () => App);
