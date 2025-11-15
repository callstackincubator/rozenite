import { AppRegistry } from 'react-native';
import App from './app/App';

import 'react-native-get-random-values';

import { withOnBootNetworkActivityRecording } from '@rozenite/network-activity-plugin/react-native';
import { api } from './app/utils/network-activity/api';

withOnBootNetworkActivityRecording();

// Make a fetch request during boot to test network inspector queuing
api.getUsers().then(() => {
  console.log('Fetched users during app boot');
});

AppRegistry.registerComponent('Playground', () => App);
