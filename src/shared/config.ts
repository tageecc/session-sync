export interface SyncConfig {
  passphrase: string
  customBackend?: {
    url: string
    anonKey: string
  }
}

export interface PlanInfo {
  plan: 'free' | 'pro'
  origin_used: number
  origin_limit: number
}

const STORAGE_KEY = 'syncConfig'
const PLAN_CACHE_KEY = 'planCache'

/** Free plan origin limit (must match server-side value) */
export const FREE_PLAN_LIMIT = 3

/**
 * Upgrade URLs (from .env).
 * The extension appends ?client_reference_id={user_hash} when opening.
 * If both are empty, the upgrade UI will be hidden (e.g. self-hosted users).
 */
const UPGRADE_URL_DEFAULT = import.meta.env.VITE_UPGRADE_URL ?? ''
const UPGRADE_URL_CN = import.meta.env.VITE_UPGRADE_URL_CN ?? ''

/** Pick the correct upgrade URL based on browser language */
export function getUpgradeUrl(): string {
  if (UPGRADE_URL_CN && chrome.i18n.getUILanguage().startsWith('zh')) {
    return UPGRADE_URL_CN
  }
  return UPGRADE_URL_DEFAULT
}

/** Whether upgrade UI should be shown */
export const HAS_UPGRADE = !!(UPGRADE_URL_DEFAULT || UPGRADE_URL_CN)

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

/** Read cached plan info */
export async function getCachedPlan(): Promise<PlanInfo | null> {
  const result = await chrome.storage.local.get(PLAN_CACHE_KEY)
  return result[PLAN_CACHE_KEY] ?? null
}

/** Save plan info to local cache */
export async function cachePlan(plan: PlanInfo): Promise<void> {
  await chrome.storage.local.set({ [PLAN_CACHE_KEY]: plan })
}
