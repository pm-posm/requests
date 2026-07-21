import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
// @ts-ignore
import '@fontsource-variable/geist';
import './index.css';

// Global error overlay for debugging
const errorList: string[] = [];
window.onerror = function (msg, url, line, col, error) {
  const errStr = `Error: ${msg} at ${line}:${col}`;
  errorList.push(errStr);
  updateErrorOverlay();
  return false;
};
window.addEventListener('unhandledrejection', function (event) {
  const errStr = `Unhandled Rejection: ${event.reason?.message || event.reason}`;
  errorList.push(errStr);
  updateErrorOverlay();
});

function updateErrorOverlay() {
  let div = document.getElementById('debug-error-overlay');
  if (!div) {
    div = document.createElement('div');
    div.id = 'debug-error-overlay';
    div.style.position = 'fixed';
    div.style.bottom = '10px';
    div.style.right = '10px';
    div.style.backgroundColor = 'rgba(220, 38, 38, 0.9)';
    div.style.color = 'white';
    div.style.padding = '12px';
    div.style.borderRadius = '8px';
    div.style.fontSize = '11px';
    div.style.zIndex = '999999';
    div.style.maxWidth = '400px';
    div.style.maxHeight = '200px';
    div.style.overflowY = 'auto';
    div.style.fontFamily = 'monospace';
    document.body.appendChild(div);
  }
  div.innerHTML = `<strong>Console Errors:</strong><br/>` + errorList.map(e => `• ${e}`).join('<br/>');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
