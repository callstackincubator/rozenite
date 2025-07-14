import React from 'react';
import ReactDOM from 'react-dom/client';
import { Panel } from './Panel.js';

const rootEl = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootEl);
root.render(React.createElement(Panel));
