import { NoticeBadge } from './notice-badge';
import { ReduxDevTools } from './redux-devtools';

import './panel.css';

export default function ReduxDevToolsPanel() {
  return (
    <div className="app">
      <NoticeBadge
        title="Limited Functionality"
        text="Time travel and action dispatch are currently unavailable in remote mode."
        linkUrl="https://github.com/reduxjs/redux-devtools/issues/1340"
      />

      <NoticeBadge
        title="Device scoping"
        text="Redux DevTools are not currently scoped to a specific device. Make sure to select the correct instance of the store."
      />

      <ReduxDevTools />
    </div>
  );
}
