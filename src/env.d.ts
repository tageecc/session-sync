/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Upgrade URL (international) */
  readonly VITE_UPGRADE_URL?: string
  /** Upgrade URL (China region) */
  readonly VITE_UPGRADE_URL_CN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
