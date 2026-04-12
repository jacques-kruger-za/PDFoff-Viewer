import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

const bootSplash = document.getElementById('boot-splash')

if (bootSplash) {
  window.setTimeout(() => {
    bootSplash.classList.add('is-exiting')
  }, 1200)

  window.setTimeout(() => {
    bootSplash.remove()
  }, 1800)
}
