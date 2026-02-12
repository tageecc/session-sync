/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Stripe Payment Link for international users (USD) */
  readonly VITE_UPGRADE_URL?: string
  /** Stripe Payment Link for Chinese users (CNY, supports Alipay & WeChat Pay) */
  readonly VITE_UPGRADE_URL_CN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
