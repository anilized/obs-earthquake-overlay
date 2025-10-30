import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { applyTheme, loadSettings } from './lib/config'

// Apply saved theme early so Tailwind dark classes take effect before paint
try { applyTheme(loadSettings().theme) } catch {}

createRoot(document.getElementById('root')!).render(
  //<React.StrictMode>
    <App />
  //</React.StrictMode>,
)
