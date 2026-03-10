/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_BACKEND_URL: string
  readonly VITE_WS_API_KEY: string
  // Add other environment variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

