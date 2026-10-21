import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/os.css'
import './os/longPress'
import './os/theme'
import './os/konami'

// No browser right-click menu: the site has its own (desktop right-click).
// Text fields keep it, so copy/paste still works in the Konsole and search.
window.addEventListener('contextmenu', (e) => {
  const t = e.target as HTMLElement | null
  if (t?.closest('input, textarea, [contenteditable="true"]')) return
  e.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
