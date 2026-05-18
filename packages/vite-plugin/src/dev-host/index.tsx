import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BaseProvider, DarkTheme } from 'baseui';
import { Client as Styletron } from 'styletron-engine-monolithic';
import { Provider as StyletronProvider } from 'styletron-react';
import { App } from './App.js';
import { getDevHostFlows, getDevHostTemplates } from './config.js';
import './styles.css';
import { readDevHostState } from './utils.js';

const styletron = new Styletron();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Rozenite dev host failed to initialize.');
}

const state = readDevHostState();
const flows = getDevHostFlows();
const templates = getDevHostTemplates();

createRoot(rootElement).render(
  <StrictMode>
    <StyletronProvider value={styletron}>
      <BaseProvider theme={DarkTheme}>
        <App {...state} flows={flows} templates={templates} />
      </BaseProvider>
    </StyletronProvider>
  </StrictMode>,
);
