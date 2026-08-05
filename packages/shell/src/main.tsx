import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Shell, SHELL_CONFIGURATION_TYPE } from './Shell';
import type { ShellConfiguration } from './types';
import './styles.css';

function App() {
  const [configuration, setConfiguration] = useState<ShellConfiguration>({
    plugins: [],
  });

  useEffect(() => {
    const receiveConfiguration = (event: MessageEvent) => {
      if (
        event.source === window.parent &&
        event.data?.type === SHELL_CONFIGURATION_TYPE
      ) {
        setConfiguration(event.data.payload as ShellConfiguration);
      }
    };

    window.addEventListener('message', receiveConfiguration);
    window.parent.postMessage({ type: 'rozenite-shell-ready' }, '*');

    return () => window.removeEventListener('message', receiveConfiguration);
  }, []);

  return <Shell plugins={configuration.plugins} />;
}

createRoot(document.getElementById('root')!).render(<App />);
