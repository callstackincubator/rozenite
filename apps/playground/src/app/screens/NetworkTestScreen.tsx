import { createSection, useRozeniteControlsPlugin } from '@rozenite/controls-plugin';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Text } from 'react-native';
import EventSource from 'react-native-sse';
import { useNavigation } from '@react-navigation/native';
import {
  Button,
  Card,
  KeyValueRow,
  PluginHeader,
  Row,
  Screen,
  SegmentedTabs,
} from '../components/ui';
import { NavigationProp } from '../navigation/types';
import { useTheme } from '../theme/useTheme';
import { api } from '../utils/network-activity/api';
import { expoFetchApi } from '../utils/network-activity/expo';
import { nitroApi } from '../utils/network-activity/nitro';

type Transport = 'fetch' | 'expo' | 'nitro';

type ActionResult = {
  title: string;
  status: number;
  body: string;
};

const prettyPrint = (value: unknown) => JSON.stringify(value, null, 2);

const fetchGet = async (): Promise<ActionResult> => {
  const users = await api.getUsers();
  return { title: 'fetch GET users', status: 200, body: prettyPrint(users) };
};

const fetchPost = async (): Promise<ActionResult> => {
  const post = await api.createPost({
    title: 'Rozenite fetch test post',
    body: 'Created from the playground using the built-in fetch client.',
    userId: 1,
  });
  return { title: 'fetch POST post', status: 200, body: prettyPrint(post) };
};

const fetchSlow = async (): Promise<ActionResult> => {
  const users = await api.getSlowData();
  return { title: 'fetch slow GET users', status: 200, body: prettyPrint(users) };
};

const fetchAbort = async (): Promise<ActionResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 250);

  try {
    await fetch('https://httpbin.org/delay/5', {
      signal: controller.signal,
      headers: { 'X-Rozenite-Test': 'fetch-abort' },
    });
    return { title: 'fetch AbortController', status: 200, body: 'Unexpected success' };
  } catch (error) {
    return {
      title: 'fetch AbortController',
      status: 0,
      body: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const fetchDownload = async (): Promise<ActionResult> => {
  const buffer = await api.getLargeFile();
  return { title: 'fetch download', status: 200, body: `Downloaded ${buffer.byteLength} bytes` };
};

const expoGet = async (): Promise<ActionResult> => {
  const result = await expoFetchApi.getUsers();
  return { title: result.title, status: result.status, body: result.body };
};

const expoAbort = async (): Promise<ActionResult> => {
  const result = await expoFetchApi.abortSlowRequest();
  return { title: result.title, status: result.status, body: result.body };
};

const nitroGet = async (): Promise<ActionResult> => {
  const result = await nitroApi.getUsers();
  return { title: result.title, status: result.status, body: result.body };
};

const nitroPost = async (): Promise<ActionResult> => {
  const result = await nitroApi.createPost();
  return { title: result.title, status: result.status, body: result.body };
};

const nitroAbort = async (): Promise<ActionResult> => {
  const result = await nitroApi.abortSlowRequest();
  return { title: result.title, status: result.status, body: result.body };
};

type TransportActions = {
  get: () => Promise<ActionResult>;
  post?: () => Promise<ActionResult>;
  slow?: () => Promise<ActionResult>;
  abort?: () => Promise<ActionResult>;
  download?: () => Promise<ActionResult>;
};

// Every transport exposes the same fixed set of buttons — GET, POST, Slow,
// Abort, Download — but each one only wires up what its client actually
// supports. Missing actions render disabled so the layout never shifts.
const TRANSPORT_ACTIONS: Record<Transport, TransportActions> = {
  fetch: {
    get: fetchGet,
    post: fetchPost,
    slow: fetchSlow,
    abort: fetchAbort,
    download: fetchDownload,
  },
  expo: { get: expoGet, abort: expoAbort },
  nitro: { get: nitroGet, post: nitroPost, abort: nitroAbort },
};

const WS_URL = 'wss://echo.websocket.org';
const SSE_URL = 'https://stream.wikimedia.org/v2/stream/recentchange';

export const NetworkTestScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [transport, setTransport] = useState<Transport>('fetch');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsLastMessage, setWsLastMessage] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [sseLastMessage, setSseLastMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const actions = TRANSPORT_ACTIONS[transport];

  const run = useCallback((action?: () => Promise<ActionResult>) => {
    if (!action) {
      return;
    }

    void action()
      .then(setResult)
      .catch((error) =>
        setResult({
          title: 'Request failed',
          status: 0,
          body: error instanceof Error ? error.message : String(error),
        }),
      );
  }, []);

  const toggleWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setWsConnected(false);
      return;
    }

    const ws = new WebSocket(WS_URL);
    ws.onopen = () => setWsConnected(true);
    ws.onmessage = (event) => setWsLastMessage(String(event.data));
    ws.onclose = () => setWsConnected(false);
    wsRef.current = ws;
  }, []);

  const toggleSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
      setSseConnected(false);
      return;
    }

    const es = new EventSource(SSE_URL);
    es.addEventListener('open', () => setSseConnected(true));
    es.addEventListener('message', (event) => setSseLastMessage(event.data ?? null));
    es.addEventListener('error', () => setSseConnected(false));
    sseRef.current = es;
  }, []);

  const networkControlsSections = useMemo(
    () => [
      createSection({
        id: 'network-playground',
        title: 'Network Playground',
        description:
          'Local controls registered from the Network screen, mounted alongside the app-level Controls sections.',
        items: [
          {
            id: 'active-transport',
            type: 'text' as const,
            title: 'Active Transport',
            value: transport,
          },
          {
            id: 'reset-transport',
            type: 'button' as const,
            title: 'Reset to fetch',
            actionLabel: 'Reset',
            onPress: () => setTransport('fetch'),
          },
          {
            id: 'request-body-test',
            type: 'button' as const,
            title: 'Open Request Body Test',
            actionLabel: 'Open',
            onPress: () => navigation.navigate('RequestBodyTest'),
          },
        ],
      }),
    ],
    [navigation, transport],
  );

  useRozeniteControlsPlugin({ sections: networkControlsSections });

  return (
    <Screen>
      <PluginHeader
        title="Network Activity"
        subtitle="Trigger a request, observe it in Network Activity DevTools."
      />

      <Row>
        <Button
          label="Request body test"
          variant="secondary"
          onPress={() => navigation.navigate('RequestBodyTest')}
        />
      </Row>

      <SegmentedTabs
        accessibilityLabel="Network transport"
        value={transport}
        onChange={setTransport}
        options={[
          { value: 'fetch', label: 'fetch' },
          { value: 'expo', label: 'expo' },
          { value: 'nitro', label: 'nitro' },
        ]}
      />

      <Card>
        <Row wrap>
          <Button label="GET" onPress={() => run(actions.get)} />
          <Button label="POST" disabled={!actions.post} onPress={() => run(actions.post)} />
          <Button label="Slow" disabled={!actions.slow} onPress={() => run(actions.slow)} />
          <Button label="Abort" disabled={!actions.abort} onPress={() => run(actions.abort)} />
          <Button
            label="Download"
            disabled={!actions.download}
            onPress={() => run(actions.download)}
          />
        </Row>
      </Card>

      {result ? (
        <Card>
          <KeyValueRow label="Result" value={result.title} />
          <KeyValueRow label="Status" value={String(result.status)} />
          <Text
            numberOfLines={4}
            style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSize.xs }}
          >
            {result.body}
          </Text>
        </Card>
      ) : null}

      <Card>
        <KeyValueRow label="WebSocket" value={wsConnected ? 'Connected' : 'Disconnected'} />
        {wsLastMessage ? <KeyValueRow label="Last message" value={wsLastMessage} /> : null}
        <Button
          label={wsConnected ? 'Disconnect WebSocket' : 'Connect WebSocket'}
          variant={wsConnected ? 'destructive' : 'default'}
          onPress={toggleWebSocket}
        />
      </Card>

      <Card>
        <KeyValueRow label="SSE" value={sseConnected ? 'Connected' : 'Disconnected'} />
        {sseLastMessage ? <KeyValueRow label="Last message" value={sseLastMessage} /> : null}
        <Button
          label={sseConnected ? 'Disconnect SSE' : 'Connect SSE'}
          variant={sseConnected ? 'destructive' : 'default'}
          onPress={toggleSSE}
        />
      </Card>
    </Screen>
  );
};
