import { createExpoAtlasMiddleware } from 'expo-atlas/cli';
import baseSerializer from 'expo-atlas-without-expo/base-serializer';
import connect from 'connect';
import { getDevToolsPluginClient } from '@rozenite/plugin-bridge';

const initClient = async () => {
  const client = await getDevToolsPluginClient('hello-world-plugin');
  client.onMessage('handshake', (payload: unknown) => {
    client.send('handshake', payload + 'bar');
  });
  process.addListener('beforeExit', () => client.close());
};

const withExpoAtlas = (config: any): any => {
  if (!config.serializer?.customSerializer) {
    config.serializer = {
      ...config.serializer,
      customSerializer: baseSerializer.getBaseSerializer(),
    };
  }

  const instance = createExpoAtlasMiddleware(config);

  return {
    ...config,
    server: {
      ...config.server,
      enhanceMiddleware: (middleware, server) => {
        const prevMiddleware =
          config.server?.enhanceMiddleware?.(middleware, server) ?? middleware;
        return connect()
          .use(prevMiddleware)
          .use('/_expo/atlas', instance.middleware);
      },
    },
  };
};

const withReduxDevTools = (config: any): any => {
  const WebSocket = require('ws');
  const wss = new WebSocket.Server({ port: 8000 });

  wss.on('connection', function connection(ws) {
    console.log('Connected!');
    ws.on('message', function incoming(message) {
      // Broadcast to all clients except the sender
      wss.clients.forEach(function each(client) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    });
  });

  return config;
};

const withHelloWorldPlugin = (config: any): any => {
  initClient();

  return withExpoAtlas(withReduxDevTools(config));
};

export default withHelloWorldPlugin;
