import {
  getRozeniteDevToolsClient,
  type RozeniteDevToolsClient,
} from '@rozenite/plugin-bridge';
import {
  ReduxDevToolsBridgeEventMap,
  ReduxDevToolsPanelCommand,
  ReduxDevToolsRuntimeMessage,
} from './shared/protocol';

const PLUGIN_ID = '@rozenite/redux-devtools-plugin';
const MAX_QUEUED_MESSAGES = 200;

const getRandomId = () => Math.random().toString(36).slice(2);

type PanelCommandListener = (command: ReduxDevToolsPanelCommand) => void;

let client: RozeniteDevToolsClient<ReduxDevToolsBridgeEventMap> | null = null;
let initPromise: Promise<void> | null = null;
const commandListeners = new Set<PanelCommandListener>();
const queuedMessages: ReduxDevToolsRuntimeMessage[] = [];

const connectionId = getRandomId();

const flushQueue = () => {
  if (!client || queuedMessages.length === 0) {
    return;
  }

  const messages = queuedMessages.splice(0, queuedMessages.length);
  messages.forEach((message) => {
    client?.send('runtime-message', message);
  });
};

const ensureClient = () => {
  if (client) {
    return;
  }

  if (initPromise) {
    return;
  }

  initPromise = getRozeniteDevToolsClient<ReduxDevToolsBridgeEventMap>(
    PLUGIN_ID
  )
    .then((resolvedClient: RozeniteDevToolsClient<ReduxDevToolsBridgeEventMap>) => {
      client = resolvedClient;

      client.onMessage('panel-command', (command: ReduxDevToolsPanelCommand) => {
        commandListeners.forEach((listener) => {
          listener(command);
        });
      });

      flushQueue();
    })
    .catch((error: unknown) => {
      console.warn(
        '[Rozenite, redux-devtools] Failed to initialize bridge client.',
        error
      );
    })
    .finally(() => {
      initPromise = null;
    });
};

export const getRuntimeConnectionId = (): string => connectionId;

export const sendRuntimeMessage = (message: ReduxDevToolsRuntimeMessage) => {
  if (client) {
    client.send('runtime-message', message);
    return;
  }

  if (queuedMessages.length >= MAX_QUEUED_MESSAGES) {
    queuedMessages.shift();
  }

  queuedMessages.push(message);
  ensureClient();
};

export const subscribeToPanelCommands = (listener: PanelCommandListener) => {
  commandListeners.add(listener);
  ensureClient();

  return () => {
    commandListeners.delete(listener);
  };
};
