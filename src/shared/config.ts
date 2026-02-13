export interface SyncConfig {
  passphrase: string
  customBackend?: {
    url: string
    anonKey: string
  }
}

const STORAGE_KEY = 'syncConfig'

/** Read the sync configuration from chrome.storage.local */
export async function getConfig(): Promise<SyncConfig | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return result[STORAGE_KEY] ?? null
}

/** Persist the sync configuration to chrome.storage.local */
export async function saveConfig(config: SyncConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: config })
}

/** Check whether a sync key has been set */
export async function isConfigured(): Promise<boolean> {
  const config = await getConfig()
  return !!config?.passphrase
}
