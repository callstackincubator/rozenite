import { callstackDevtoolsApi } from '@rozenite/devtools-core/guest';

callstackDevtoolsApi.createPanel('Redux DevTools', './redux-devtools.html');
callstackDevtoolsApi.createPanel('Expo Atlas', './expo-atlas.html');
callstackDevtoolsApi.createPanel('TanStack Query', './tanstack-query.html');
callstackDevtoolsApi.createPanel('Native World', './native-world.html');
