import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { applyTheme, loadThemePrefs } from './theme.jsx';

// Apply persisted theme before first paint to avoid a flash.
const prefs = loadThemePrefs();
if (prefs) applyTheme(prefs.mode, prefs.palette);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);