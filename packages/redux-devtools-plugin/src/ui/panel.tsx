import { ReduxDevTools } from './redux-devtools';

import './panel.css';

export default function ReduxDevToolsPanel() {
  return (
    <div className="app">
      <ReduxDevTools />
    </div>
  );
}
