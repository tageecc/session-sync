import { getConfig, saveConfig } from '../shared/config'
import { t, applyI18n } from '../shared/i18n'
import { toast } from '../shared/toast'

// ── DOM references ──────────────────────────────────────────────

const currentKeyEl = document.getElementById('current-key')!
const toggleKeyBtn = document.getElementById('toggle-key-btn') as HTMLButtonElement
const copyKeyBtn = document.getElementById('copy-key-btn') as HTMLButtonElement

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
}

init()

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
