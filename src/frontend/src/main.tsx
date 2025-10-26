import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// SuperTokens initialization
import SuperTokensProvider from "supertokens-auth-react";
import { supertokensConfig } from './config/supertokens';

SuperTokensProvider.init(supertokensConfig);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
