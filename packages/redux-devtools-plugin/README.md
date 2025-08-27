![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin that provides Redux DevTools integration for React Native applications.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite Redux DevTools Plugin provides Redux state inspection and debugging capabilities within your React Native DevTools environment. It offers a partial Redux DevTools experience, including state inspection and action history (time travel and action dispatch are currently unavailable in remote mode).

![Redux DevTools Plugin](https://rozenite.dev/redux-devtools-plugin.png)

## Features

- **Redux State Inspection**: View and explore your Redux store state in real-time
- **Action History**: Track all dispatched actions with timestamps and payloads
- **State Diff Viewing**: See exactly how each action changes your state
- **Production Safety**: Automatically disabled in production builds

## Installation

### 1. Install the Plugin

Install the Redux DevTools plugin and peer dependencies:

```bash
npm install -D @rozenite/redux-devtools-plugin
npm install react-native-get-random-values
```

**Important**: After installing `react-native-get-random-values`, you need to import it at the very top of your entry file (usually `index.js` or `App.js`):

```javascript
import 'react-native-get-random-values';
// ... rest of your imports
```

For more detailed setup instructions, please refer to the [react-native-get-random-values documentation](https://github.com/LinusU/react-native-get-random-values).

### 2. Set up the Store Enhancer

Add the Redux DevTools enhancer to your Redux store:

#### For Redux Toolkit (Recommended)

```typescript
// store.ts
import { configureStore } from '@reduxjs/toolkit';
import { rozeniteDevToolsEnhancer } from '@rozenite/redux-devtools-plugin';
import rootReducer from './reducers';

const store = configureStore({
  reducer: rootReducer,
  enhancers: (getDefaultEnhancers) =>
    getDefaultEnhancers().concat(rozeniteDevToolsEnhancer()),
});

export default store;
```

#### For Classic Redux

```typescript
// store.ts
import { createStore, applyMiddleware } from 'redux';
import { rozeniteDevToolsEnhancer } from '@rozenite/redux-devtools-plugin';
import rootReducer from './reducers';

const store = createStore(
  rootReducer,
  applyMiddleware(/* your middleware */),
  rozeniteDevToolsEnhancer()
);

export default store;
```

### 3. Configure Metro

Wrap your Metro configuration with `withRozeniteReduxDevTools`:

```typescript
// metro.config.js
import { withRozeniteReduxDevTools } from '@rozenite/redux-devtools-plugin/metro';

export default withRozeniteReduxDevTools({
  // your existing metro config
});
```

This setup enables the WebSocket relay that allows the Redux DevTools to communicate with your React Native app.

### 4. Access DevTools

Start your development server and open React Native DevTools. You'll find the "Redux DevTools" panel in the DevTools interface.

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/redux-devtools-plugin
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
