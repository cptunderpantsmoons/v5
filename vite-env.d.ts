/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
  readonly VITE_APP_TITLE: string
  // Add more env variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}