/// <reference types="vite/client" />

interface ImportMetaEnv {
  VITE_FRONTEND_IP: string
  VITE_FRONTEND_PORT: string
  VITE_BACKEND_IP?: string
  VITE_BACKEND_PORT?: string
  VITE_DOCKER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
