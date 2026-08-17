import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ServerProvider } from './context/ServerContext';
import { NetworkProvider } from './context/NetworkContext';
import { DialogProvider } from './context/DialogContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DialogProvider>
      <ServerProvider>
        <NetworkProvider>
          <App />
        </NetworkProvider>
      </ServerProvider>
    </DialogProvider>
  </React.StrictMode>
);
