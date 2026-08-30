import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterApplication } from './RouterApplication'
import './styles.css'
import './project-styles.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Application root element is missing.')

createRoot(rootElement).render(
  <StrictMode>
    <RouterApplication />
  </StrictMode>,
)
