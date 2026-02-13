import { sendToBackground } from '../shared/messaging'
import { isConfigured, saveConfig, getConfig } from '../shared/config'
import { generateSyncKey, isValidSyncKey } from '../shared/crypto'
import { t, applyI18n } from '../shared/i18n'
import { toast } from '../shared/toast'

// ── DOM references ──────────────────────────────────────────────

const settingsBtn = document.getElementById('settings-btn')!

const stepWelcome = document.getElementById('step-welcome')!
const stepShowKey = document.getElementById('step-show-key')!
const stepImport = document.getElementById('step-import')!
const stepMain = document.getElementById('step-main')!

const createBtn = document.getElementById('create-btn') as HTMLButtonElement
const importToggleBtn = document.getElementById('import-toggle-btn') as HTMLButtonElement

const generatedKeyEl = document.getElementById('generated-key')!
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement
const confirmBtn = document.getElementById('confirm-btn') as HTMLButtonElement

const importInput = document.getElementById('import-input') as HTMLInputElement
const importBtn = document.getElementById('import-btn') as HTMLButtonElement
const backBtn = document.getElementById('back-btn') as HTMLButtonElement

const pushBtn = document.getElementById('push-btn') as HTMLButtonElement
const pullBtn = document.getElementById('pull-btn') as HTMLButtonElement
const domainEl = document.getElementById('domain')!

const ALL_STEPS = [stepWelcome, stepShowKey, stepImport, stepMain]

// ── Helpers ─────────────────────────────────────────────────────

function showStep(step: HTMLElement) {
  ALL_STEPS.forEach((s) => s.classList.add('hidden'))
  step.classList.remove('hidden')
  settingsBtn.classList.toggle('hidden', step !== stepMain)
}

function showMain() {
  showStep(stepMain)
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const url = tab?.url ?? ''
    const isSyncable = /^https?:\/\//.test(url)

    if (isSyncable) {
      try { domainEl.textContent = new URL(url).hostname } catch { /* ignore */ }
      pushBtn.disabled = false
      pullBtn.disabled = false
      pushBtn.title = ''
      pullBtn.title = ''
    } else {
      domainEl.textContent = url ? new URL(url).protocol.replace(':', '') + '://…' : '-'
      pushBtn.disabled = true
      pullBtn.disabled = true
      pushBtn.title = t('unsupportedPage')
      pullBtn.title = t('unsupportedPage')
    }
  })
}

// ── Init ────────────────────────────────────────────────────────

applyI18n()

async function init() {
  if (await isConfigured()) {
    showMain()
  } else {
    showStep(stepWelcome)
  }
}

init()

// ── Create new key ──────────────────────────────────────────────

let pendingKey = ''

createBtn.addEventListener('click', () => {
  pendingKey = generateSyncKey()
  generatedKeyEl.textContent = pendingKey
  showStep(stepShowKey)
})

// ── Copy key ────────────────────────────────────────────────────

copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(pendingKey)
  toast(t('copied'), true)
})

// ── Confirm & save ──────────────────────────────────────────────

confirmBtn.addEventListener('click', async () => {
  confirmBtn.disabled = true
  confirmBtn.textContent = t('saving')

  try {
    const existing = await getConfig()
    await saveConfig({ passphrase: pendingKey, customBackend: existing?.customBackend })
    toast(t('keySaved'), true)
    setTimeout(showMain, 400)
  } catch (e) {
    toast(t('saveFailed', String(e)), false)
    confirmBtn.disabled = false
    confirmBtn.textContent = t('confirmStart')
  }
})

// ── Import existing key ─────────────────────────────────────────

importToggleBtn.addEventListener('click', () => {
  showStep(stepImport)
  setTimeout(() => importInput.focus(), 50)
})

backBtn.addEventListener('click', () => showStep(stepWelcome))

// Auto-format input: insert dashes for XXXXXX-XXXXXX-XXXXXX-XXXXXX
importInput.addEventListener('input', () => {
  const raw = importInput.value.replace(/[^A-Za-z2-9]/g, '').toUpperCase().slice(0, 24)
  const parts: string[] = []
  for (let i = 0; i < raw.length; i += 6) parts.push(raw.slice(i, i + 6))
  importInput.value = parts.join('-')
})

importInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') importBtn.click()
})

importBtn.addEventListener('click', async () => {
  const key = importInput.value.toUpperCase().trim()

  if (!isValidSyncKey(key)) {
    toast(t('invalidKeyFormat'), false)
    importInput.focus()
    return
  }

  importBtn.disabled = true
  importBtn.textContent = t('importing')

  try {
    const existing = await getConfig()
    await saveConfig({ passphrase: key, customBackend: existing?.customBackend })
    toast(t('importSuccess'), true)
    setTimeout(showMain, 400)
  } catch (e) {
    toast(t('importFailed', String(e)), false)
    importBtn.disabled = false
    importBtn.textContent = t('confirmImport')
  }
})

// ── Settings ────────────────────────────────────────────────────

settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage())

// ── Push / Pull ─────────────────────────────────────────────────

pushBtn.addEventListener('click', () => handleSync(pushBtn, 'PUSH'))
pullBtn.addEventListener('click', () => handleSync(pullBtn, 'PULL'))

async function handleSync(btn: HTMLButtonElement, type: 'PUSH' | 'PULL') {
  const label = btn.querySelector<HTMLElement>('[data-i18n]')!
  const originalText = label.textContent!
  pushBtn.disabled = pullBtn.disabled = true
  label.textContent = t(type === 'PUSH' ? 'pushing' : 'pulling')

  const res = await sendToBackground(type)

  if (res.success) {
    const detail = type === 'PUSH'
      ? t('sessionSaved')
      : (res.data?.msg ?? t('sessionRestored'))
    toast(detail, true)
  } else {
    toast(res.error ?? t(type === 'PUSH' ? 'pushFailed' : 'pullFailed'), false)
  }

  label.textContent = originalText
  pushBtn.disabled = pullBtn.disabled = false
}
