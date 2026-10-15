import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './nav-fix.css'
import App from './App.jsx'
import { registerPwa } from './pwa.js'

registerPwa()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)