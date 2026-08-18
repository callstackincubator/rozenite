import { createRoot } from 'react-dom/client';
import { createDeviceConnection, type DeviceConnection } from './connection/device-connection';
import { parseTargetFromUrl, TargetUrlError } from './connection/target-from-url';
import { App, type AppTarget } from './App';
import './styles.css';

// Created once at module scope, mirroring @rozenite/shell's own `host`:
// connecting is a side effect (it opens a WebSocket), so it must not run
// inside a component body, where React (StrictMode in particular) may
// invoke it more than once.
let target: AppTarget;

try {
  const connection: DeviceConnection = createDeviceConnection(parseTargetFromUrl());
  target = { kind: 'connection', connection };
} catch (error) {
  target = {
    kind: 'error',
    error: error instanceof TargetUrlError ? error : new TargetUrlError(String(error)),
  };
}

createRoot(document.getElementById('root')!).render(<App target={target} />);
