import { sendToTab } from '../shared/messaging'
import { getSupabaseClient } from '../shared/supabaseClient'
import { getConfig } from '../shared/config'
import {
  deriveUserHash,
  deriveWriteToken,
  encrypt,
  decrypt,
  type EncryptedPayload,
} from '../shared/crypto'

// ── Types ───────────────────────────────────────────────────────

interface CookieEntry {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite: string
  expirationDate?: number
  hostOnly?: boolean
}

interface SyncPayload {
  url: string
  title: string
  cookies: CookieEntry[]
  localStorage: Array<{ key: string; value: string }>
  sessionStorage: Array<{ key: string; value: string }>
}

// ── Constants ───────────────────────────────────────────────────

/** Shorthand for chrome.i18n.getMessage */
const t = (key: string, subs?: string | string[]) =>
  chrome.i18n.getMessage(key, subs) || key

// ── Message listener ────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only accept messages from this extension
  if (sender.id !== chrome.runtime.id) return

  if (message.type === 'PUSH') void handlePush(sendResponse)
  else if (message.type === 'PULL') void handlePull(sendResponse)

  return true // keep message channel open for async response
})

// ── Config helper ───────────────────────────────────────────────

async function requireConfig() {
  const config = await getConfig()
  return config?.passphrase ? config : null
}

// ── Cookie utilities ────────────────────────────────────────────

async function getStoreId(tabId: number): Promise<string> {
  const stores = await chrome.cookies.getAllCookieStores()
  const store = stores.find((s) => s.tabIds.includes(tabId))
  return store?.id ?? '0'
}

/** Collect all cookies for a URL, deduplicating by domain+name+path */
async function getAllCookies(tabUrl: string, hostname: string, storeId: string) {
  const byUrl = await chrome.cookies.getAll({ url: tabUrl, storeId })
  const byDomain = await chrome.cookies.getAll({ domain: hostname, storeId })

  const seen = new Set<string>()
  return [...byUrl, ...byDomain].filter((c) => {
    const key = `${c.domain}\t${c.name}\t${c.path}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Build a URL suitable for chrome.cookies API from cookie attributes */
function cookieUrl(domain: string, path: string, secure: boolean): string {
  const host = domain.startsWith('.') ? domain.slice(1) : domain
  return `${secure ? 'https' : 'http'}://${host}${path}`
}

// ── Push (encrypt & upload via RPC with write_token) ────────────

async function handlePush(respond: (r: unknown) => void) {
  try {
    const config = await requireConfig()
    if (!config) return respond({ success: false, error: t('configRequired') })

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !tab.url) return respond({ success: false, error: t('cannotGetPage') })

    const url = new URL(tab.url)
    const storeId = await getStoreId(tab.id)
    const cookies = await getAllCookies(tab.url, url.hostname, storeId)
    const storage = await sendToTab(tab.id, 'GET_STORAGE')

    const plainData: SyncPayload = {
      url: tab.url,
      title: tab.title ?? '',
      cookies: cookies.map(({ name, value, domain, path, secure, httpOnly, sameSite, expirationDate, hostOnly }) => ({
        name, value, domain, path, secure, httpOnly, sameSite, expirationDate, hostOnly,
      })),
      localStorage: storage.data?.localStorage ?? [],
      sessionStorage: storage.data?.sessionStorage ?? [],
    }

    const [encrypted, userHash, writeToken] = await Promise.all([
      encrypt(plainData, config.passphrase),
      deriveUserHash(config.passphrase),
      deriveWriteToken(config.passphrase),
    ])

    const supabase = await getSupabaseClient()
    const { error } = await supabase.rpc('upsert_sync_data', {
      p_user_hash: userHash,
      p_origin: url.origin,
      p_encrypted_payload: encrypted.ciphertext,
      p_iv: encrypted.iv,
      p_salt: encrypted.salt,
      p_write_token: writeToken,
    })

    if (error) return respond({ success: false, error: error.message })

    respond({ success: true })
  } catch (e) {
    respond({ success: false, error: String(e) })
  }
}

// ── Pull (download & decrypt) ───────────────────────────────────

async function handlePull(respond: (r: unknown) => void) {
  try {
    const config = await requireConfig()
    if (!config) return respond({ success: false, error: t('configRequired') })

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !tab.url) return respond({ success: false, error: t('cannotGetPage') })

    const url = new URL(tab.url)
    const storeId = await getStoreId(tab.id)
    const userHash = await deriveUserHash(config.passphrase)

    const supabase = await getSupabaseClient()
    const { data, error } = await supabase
      .rpc('read_sync_data', {
        p_user_hash: userHash,
        p_origin: url.origin,
      })
      .maybeSingle()

    if (error) return respond({ success: false, error: error.message })
    if (!data) return respond({ success: false, error: t('noCloudData', url.origin) })

    const row = data as { encrypted_payload: string; iv: string; salt: string }
    const payload: EncryptedPayload = {
      ciphertext: row.encrypted_payload,
      iv: row.iv,
      salt: row.salt,
    }

    let plainData: SyncPayload
    try {
      plainData = await decrypt(payload, config.passphrase)
    } catch {
      return respond({ success: false, error: t('decryptFailed') })
    }

    // Clear existing cookies for this origin, then restore from backup
    const existing = await getAllCookies(tab.url, url.hostname, storeId)
    for (const c of existing) {
      await chrome.cookies.remove({
        url: cookieUrl(c.domain, c.path, c.secure),
        name: c.name,
        storeId,
      })
    }

    let setOk = 0
    let setFail = 0
    for (const c of plainData.cookies) {
      const details: chrome.cookies.SetDetails = {
        url: cookieUrl(c.domain, c.path, c.secure),
        name: c.name,
        value: c.value,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: (c.sameSite ?? 'unspecified') as chrome.cookies.SameSiteStatus,
        storeId,
      }
      if (!c.hostOnly) details.domain = c.domain
      if (c.expirationDate) details.expirationDate = c.expirationDate

      const result = await chrome.cookies.set(details)
      if (result) setOk++; else setFail++
    }

    // Restore localStorage & sessionStorage
    await sendToTab(tab.id, 'SET_STORAGE', {
      localStorage: plainData.localStorage ?? [],
      sessionStorage: plainData.sessionStorage ?? [],
    })

    await chrome.tabs.reload(tab.id)

    const msg = setFail
      ? t('sessionRestoredPartial', [String(setFail), String(setOk + setFail)])
      : undefined
    respond({ success: true, data: { msg } })
  } catch (e) {
    respond({ success: false, error: String(e) })
  }
}
