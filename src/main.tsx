import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './components/App.js';

import './global.css';

const rootElement = document.querySelector('#root');

if (rootElement === null) {
    throw new Error('Expected #root to exist before mounting the app.');
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
