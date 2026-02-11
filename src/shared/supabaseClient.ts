import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getConfig } from './config'

const DEFAULT_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const DEFAULT_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

let client: SupabaseClient | null = null
let currentUrl: string | null = null
let currentKey: string | null = null

export async function getSupabaseClient(): Promise<SupabaseClient> {
  const config = await getConfig()

  const url = config?.customBackend?.url || DEFAULT_URL
  const key = config?.customBackend?.anonKey || DEFAULT_ANON_KEY

  if (!client || url !== currentUrl || key !== currentKey) {
    client = createClient(url, key, {
      auth: { persistSession: false },
    })
    currentUrl = url
    currentKey = key
  }

  return client
}
