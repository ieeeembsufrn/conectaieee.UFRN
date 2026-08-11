/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
import React from 'react';
import './src/index.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import ReactDOM from 'react-dom/client';
import { App } from './App';
// @ts-ignore
import { registerSW } from 'virtual:pwa-register';

if (import.meta.env.PROD) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log("Novo conteúdo disponível. Atualizando...");
      updateSW(true);
    },
    onOfflineReady() {
      console.log("App pronto para uso offline.");
    },
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
