/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  // otras variables personalizadas aquí
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
