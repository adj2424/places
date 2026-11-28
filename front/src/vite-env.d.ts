/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLACES_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
