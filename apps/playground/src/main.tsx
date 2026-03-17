import { AppRegistry, Platform } from 'react-native';
import App from './app/App';
import { api } from './app/utils/network-activity/api';

// Make a fetch request during boot to test network activity before App initialization
api.getUsers();
api.createPost({
  title: 'Hello World',
  body: 'This is a test post created during app boot.',
  userId: 1,
});

require('@rozenite/web');

AppRegistry.registerComponent('main', () => App);

if (Platform.OS === 'web') {
  AppRegistry.runApplication('main', {
    initialProps: {},
    rootTag: document.getElementById('root'),
  });
}