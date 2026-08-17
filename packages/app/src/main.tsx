import { createRoot } from 'react-dom/client';
import { useSyncExternalStore } from 'react';
import {
  createDeviceConnection,
  type DeviceConnection,
  type DeviceState,
} from './connection/device-connection';
import { parseTargetFromUrl, TargetUrlError } from './connection/target-from-url';
import './styles.css';

// Placeholder chrome: proves the URL is parsed and the device connection
// wires up and reports state. A follow-up task replaces this with the real
// UI (`Shell`, the status footer, dialogs) built on top of the same
// `DeviceConnection`.

// Created once at module scope, mirroring @rozenite/shell's own `host`:
// connecting is a side effect (it opens a WebSocket), so it must not run
// inside a component body, where React (StrictMode in particular) may
// invoke it more than once.
let connection: DeviceConnection | null = null;
let targetError: TargetUrlError | null = null;

try {
  connection = createDeviceConnection(parseTargetFromUrl());
} catch (error) {
  targetError = error instanceof TargetUrlError ? error : new TargetUrlError(String(error));
}

function ConnectionStatus({ connection }: { connection: DeviceConnection }) {
  const state: DeviceState = useSyncExternalStore(connection.subscribe, connection.getState);
  const target = connection.getTarget();

  return (
    <div style={{ padding: 16, fontFamily: 'monospace' }}>
      <p>Device: {target.name}</p>
      <p>App: {target.appId}</p>
      <p>Status: {state.status}</p>
      {state.status !== 'connected' && state.status !== 'reloading' && (
        <button onClick={() => connection.reconnect()}>Reconnect</button>
      )}
    </div>
  );
}

function TargetErrorView({ error }: { error: TargetUrlError }) {
  return (
    <div style={{ padding: 16, fontFamily: 'monospace' }}>
      <p>Unable to determine which device to connect to.</p>
      <p>{error.message}</p>
    </div>
  );
}

function App() {
  if (targetError) {
    return <TargetErrorView error={targetError} />;
  }

  return <ConnectionStatus connection={connection!} />;
}

createRoot(document.getElementById('root')!).render(<App />);
