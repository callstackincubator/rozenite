import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Text } from 'react-native';
import {
  Button,
  Card,
  KeyValueRow,
  PluginHeader,
  Row,
  Screen,
  SegmentedTabs,
} from '../components/ui';
import { useTheme } from '../theme/useTheme';

const MIRROR_API = 'https://httpbun.com/post';

type BodyType = 'string' | 'json' | 'formdata' | 'binary';

const requestBodyApi = {
  testStringBody: async (data: string): Promise<unknown> => {
    const response = await fetch(MIRROR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'X-Rozenite-Test': 'true' },
      body: data,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },
  testJsonBody: async (data: unknown): Promise<unknown> => {
    const response = await fetch(MIRROR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Rozenite-Test': 'true' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },
  testFormDataBody: async (data: Record<string, string>): Promise<unknown> => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.append(key, value));
    const response = await fetch(MIRROR_API, {
      method: 'POST',
      headers: { 'X-Rozenite-Test': 'true' },
      body: formData,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },
  testBinaryBody: async (data: Uint8Array): Promise<unknown> => {
    const response = await fetch(MIRROR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Rozenite-Test': 'true' },
      body: data as unknown as BodyInit,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },
};

export const RequestBodyTestScreen = () => {
  const { theme } = useTheme();
  const [bodyType, setBodyType] = useState<BodyType>('string');

  const mutation = useMutation({
    mutationFn: async (type: BodyType) => {
      switch (type) {
        case 'string':
          return requestBodyApi.testStringBody('Hello, this is a test string!');
        case 'json':
          return requestBodyApi.testJsonBody({ message: 'Hello World', user: { id: 123 } });
        case 'formdata':
          return requestBodyApi.testFormDataBody({ name: 'John Doe', email: 'john@example.com' });
        case 'binary':
          return requestBodyApi.testBinaryBody(new TextEncoder().encode('Binary test data'));
      }
    },
  });

  return (
    <Screen>
      <PluginHeader title="Request Body" subtitle={`POST different body types to ${MIRROR_API}.`} />

      <SegmentedTabs
        accessibilityLabel="Request body type"
        value={bodyType}
        onChange={setBodyType}
        options={[
          { value: 'string', label: 'String' },
          { value: 'json', label: 'JSON' },
          { value: 'formdata', label: 'Form data' },
          { value: 'binary', label: 'Binary' },
        ]}
      />

      <Row>
        <Button
          label={mutation.isPending ? 'Sending…' : 'Send request'}
          disabled={mutation.isPending}
          onPress={() => mutation.mutate(bodyType)}
        />
      </Row>

      {mutation.isError ? (
        <Card>
          <KeyValueRow label="Error" value={mutation.error.message} />
        </Card>
      ) : null}

      {mutation.isSuccess ? (
        <Card>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSize.xs }}>
            {JSON.stringify(mutation.data, null, 2)}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
};
