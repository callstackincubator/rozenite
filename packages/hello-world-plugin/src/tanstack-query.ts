import React, { createElement, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { useDevToolsPluginClient } from '@callstackincubator/communication';

const Root = () => {
  const client = useDevToolsPluginClient({
    pluginId: 'hello-world-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    client.onMessage('handshake', (payload: string) => {
      console.log('handshake', payload);
    });

    client.send('handshake', 'foo');
  }, [client]);

  return createElement('div', null, 'Hello World');
};

const rootEl = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootEl);
root.render(React.createElement(Root));
