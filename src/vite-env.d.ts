/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COGNITO_USER_POOL_ID: string;
  readonly VITE_COGNITO_CLIENT_ID: string;
  /** Domínio do Cognito para login com Google (ex.: munago-estoque.auth.sa-east-1.amazoncognito.com). */
  readonly VITE_COGNITO_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
