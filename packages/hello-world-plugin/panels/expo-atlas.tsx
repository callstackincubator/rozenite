import React, { useEffect, useState } from 'react';
import { useDevToolsPluginClient } from '@rozenite/plugin-bridge';
import { Text, Button, TextInput, View } from 'react-native';

// Panel components must export a React component as default
export default function ExpoAtlasPanel() {
  const [messages, setMessages] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const client = useDevToolsPluginClient({
    pluginId: '@rozenite/hello-world-plugin',
  });

  useEffect(() => {
    client?.onMessage('test', (message) => {
      setMessages((prev) => [...prev, JSON.stringify(message)]);
    });
  }, [client]);

  return (
    <View style={{ width: '100%', height: '100%' }}>
      <TextInput value={message} onChangeText={setMessage} />
      <Button title="Send" onPress={() => client?.send('test', message)} />
      <View>
        {messages.map((message) => (
          <Text key={message}>{message}</Text>
        ))}
      </View>
    </View>
  );
}
