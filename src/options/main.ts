import { getConfig, saveConfig, getCachedPlan, getUpgradeUrl, HAS_UPGRADE, FREE_PLAN_LIMIT } from '../shared/config'
import { deriveUserHash } from '../shared/crypto'
import { sendToBackground } from '../shared/messaging'
import { t, applyI18n } from '../shared/i18n'
import { toast } from '../shared/toast'

// ── DOM references ──────────────────────────────────────────────

const currentKeyEl = document.getElementById('current-key')!
const toggleKeyBtn = document.getElementById('toggle-key-btn') as HTMLButtonElement
const copyKeyBtn = document.getElementById('copy-key-btn') as HTMLButtonElement

const planTag = document.getElementById('plan-tag')!
const planDetail = document.getElementById('plan-detail')!
const upgradeProBtn = document.getElementById('upgrade-pro-btn') as HTMLButtonElement
const refreshPlanBtn = document.getElementById('refresh-plan-btn') as HTMLButtonElement

const toggleAdvBtn = document.getElementById('toggle-advanced')!
const advancedPanel = document.getElementById('advanced-panel')!
const chevron = document.getElementById('chevron')!
const customUrlInput = document.getElementById('custom-url') as HTMLInputElement
const customKeyInput = document.getElementById('custom-key') as HTMLInputElement
const saveBackendBtn = document.getElementById('save-backend-btn') as HTMLButtonElement

// ── State ───────────────────────────────────────────────────────

let keyVisible = false
let fullKey = ''

// ── Helpers ─────────────────────────────────────────────────────

function maskKey() {
  currentKeyEl.textContent = fullKey.replace(/./g, (ch, i) =>
    i >= fullKey.length - 4 ? ch : ch === '-' ? '-' : '●',
  )
  keyVisible = false
  toggleKeyBtn.textContent = t('showKey')
}

function revealKey() {
  currentKeyEl.textContent = fullKey
  keyVisible = true
  toggleKeyBtn.textContent = t('hideKey')
}

// ── Init ────────────────────────────────────────────────────────

applyI18n()

async function init() {
  const config = await getConfig()
  if (config?.passphrase) {
    fullKey = config.passphrase
    maskKey()
  }
  if (config?.customBackend?.url) {
    customUrlInput.value = config.customBackend.url
    customKeyInput.value = config.customBackend.anonKey
    advancedPanel.classList.remove('hidden')
    chevron.classList.add('rotate-180')
  }
  void initPlanStatus()
}

init()

// ── Plan status ──────────────────────────────────────────────────

function renderPlan(plan: string, used: number, limit: number) {
  if (plan === 'pro') {
    planTag.textContent = 'Pro'
    planTag.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700'
    planDetail.textContent = t('planStatusPro')
    upgradeProBtn.classList.add('hidden')
  } else {
    planTag.textContent = t('planFree')
    planTag.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500'
    planDetail.textContent = t('planStatusFree', [String(used), String(limit)])
    if (HAS_UPGRADE) upgradeProBtn.classList.remove('hidden')
  }
}

async function initPlanStatus() {
  // Show cached plan immediately
  const cached = await getCachedPlan()
  if (cached) {
    renderPlan(cached.plan, cached.origin_used, cached.origin_limit)
  } else {
    renderPlan('free', 0, FREE_PLAN_LIMIT)
  }

  // Refresh from server
  const res = await sendToBackground('GET_PLAN')
  if (res.success && res.data) {
    renderPlan(res.data.plan, res.data.origin_used, res.data.origin_limit)
  }
}

upgradeProBtn.addEventListener('click', async () => {
  const config = await getConfig()
  if (!config?.passphrase) return

  const userHash = await deriveUserHash(config.passphrase)
  const base = getUpgradeUrl()
  const url = `${base}?client_reference_id=${encodeURIComponent(userHash)}`
  window.open(url, '_blank')
})

refreshPlanBtn.addEventListener('click', async () => {
  refreshPlanBtn.textContent = t('refreshingPlan')
  refreshPlanBtn.classList.add('pointer-events-none')

  const res = await sendToBackground('GET_PLAN')
  if (res.success && res.data) {
    renderPlan(res.data.plan, res.data.origin_used, res.data.origin_limit)
  }
  toast(t('planRefreshed'), true)

  refreshPlanBtn.textContent = t('restorePurchase')
  refreshPlanBtn.classList.remove('pointer-events-none')
})

// ── Key visibility toggle ───────────────────────────────────────

toggleKeyBtn.addEventListener('click', () => {
  if (keyVisible) maskKey(); else revealKey()
})

// ── Copy key ────────────────────────────────────────────────────

copyKeyBtn.addEventListener('click', async () => {
  if (!fullKey) return
  await navigator.clipboard.writeText(fullKey)
  copyKeyBtn.textContent = t('copied')
  setTimeout(() => { copyKeyBtn.textContent = t('copyKey') }, 1500)
})

// ── Advanced: self-hosted backend ───────────────────────────────

toggleAdvBtn.addEventListener('click', () => {
  const isHidden = advancedPanel.classList.contains('hidden')
  advancedPanel.classList.toggle('hidden')
  chevron.classList.toggle('rotate-180')
  if (isHidden) customUrlInput.focus()
})

saveBackendBtn.addEventListener('click', async () => {
  const customUrl = customUrlInput.value.trim()
  const customKey = customKeyInput.value.trim()

  if ((customUrl && !customKey) || (!customUrl && customKey)) {
    toast(t('urlAndKeyRequired'), false)
    return
  }

  if (customUrl && !customUrl.startsWith('https://')) {
    toast(t('urlMustHttps'), false)
    return
  }

  const config = await getConfig()
  if (!config) {
    toast(t('createKeyFirst'), false)
    return
  }

  saveBackendBtn.disabled = true
  saveBackendBtn.textContent = t('saving')

  try {
    await saveConfig({
      ...config,
      customBackend: customUrl && customKey
        ? { url: customUrl, anonKey: customKey }
        : undefined,
    })
    toast(t('backendSaved'), true)
  } catch (e) {
    toast(t('saveFailed', String(e)), false)
  } finally {
    saveBackendBtn.disabled = false
    saveBackendBtn.textContent = t('saveBackend')
  }
})
