import '@lynx-js/preact-devtools';
import '@lynx-js/react/debug';
// Installs the device-side dispatcher that Rozenite plugins talk to. Must run
// before any plugin's `useRozeniteDevToolsClient` does, so it is imported
// ahead of `App`.
import '@rozenite/lynx';
import { root } from '@lynx-js/react';

import { App } from './App.jsx';

root.render(<App />);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
