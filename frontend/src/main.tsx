import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initSuperTokensFrontend, SuperTokensWrapper } from './config/supertokens'

// Initialize SuperTokens before rendering
initSuperTokensFrontend();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SuperTokensWrapper>
      <App />
    </SuperTokensWrapper>
  </StrictMode>,
)
