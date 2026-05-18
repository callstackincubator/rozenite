import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { getDevHostTemplates } from './config.js';
import './styles.css';
import { readDevHostState } from './utils.js';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Rozenite dev host failed to initialize.');
}

const state = readDevHostState();
const templates = getDevHostTemplates();

createRoot(rootElement).render(
  <StrictMode>
    <App {...state} templates={templates} />
  </StrictMode>,
);
