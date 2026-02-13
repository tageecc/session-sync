import { getConfig } from '../shared/config'
import { deriveUserHash } from '../shared/crypto'
import { getSupabaseClient } from '../shared/supabaseClient'
import { sendToBackground } from '../shared/messaging'
import { t, applyI18n } from '../shared/i18n'
import { toast } from '../shared/toast'

// ── DOM ─────────────────────────────────────────────────────────

const currentKeyEl = document.getElementById('current-key')!
const toggleKeyBtn = document.getElementById('toggle-key-btn') as HTMLButtonElement
const copyKeyBtn = document.getElementById('copy-key-btn') as HTMLButtonElement

const sitesTitle = document.getElementById('sites-title')!
const sitesLoading = document.getElementById('sites-loading')!
const sitesEmpty = document.getElementById('sites-empty')!
const sitesEmptyText = document.getElementById('sites-empty-text')!
const sitesList = document.getElementById('sites-list')!

// ── State ───────────────────────────────────────────────────────

let keyVisible = false
let fullKey = ''

// ── Key helpers ─────────────────────────────────────────────────

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

// Dynamic i18n
sitesTitle.textContent = t('syncedSites')
sitesEmptyText.textContent = t('noSyncedSites')

async function init() {
  const config = await getConfig()
  if (config?.passphrase) {
    fullKey = config.passphrase
    maskKey()
  }
  loadSyncedSites().catch((e) => console.error('[Options] loadSyncedSites error:', e))
}

init()

// ── Supabase helper ─────────────────────────────────────────────

async function getUserHash(): Promise<string | null> {
  const config = await getConfig()
  if (!config?.passphrase) return null
  return deriveUserHash(config.passphrase)
}

// ── Sites list (direct Supabase call) ───────────────────────────

async function loadSyncedSites() {
  const userHash = await getUserHash()
  if (!userHash) {
    sitesLoading.classList.add('hidden')
    sitesEmpty.classList.remove('hidden')
    return
  }

  const supabase = await getSupabaseClient()
  const { data, error } = await supabase.rpc('list_user_origins', { p_user_hash: userHash })

  sitesLoading.classList.add('hidden')

  if (error || !Array.isArray(data) || !data.length) {
    if (error) console.warn('[Options] list_user_origins error:', error.message)
    sitesEmpty.classList.remove('hidden')
    return
  }

  const origins = data as Array<{ origin: string; updated_at: string }>
  sitesList.classList.remove('hidden')

  sitesList.replaceChildren()

  origins.forEach((item, i) => {
    const hostname = new URL(item.origin).hostname
    const time = formatRelativeTime(item.updated_at)

    const li = document.createElement('li')
    li.className = 'flex items-center gap-3 py-2.5 px-1 group fade-up'
    li.style.animationDelay = `${i * 40}ms`

    const img = document.createElement('img')
    img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`
    img.alt = ''
    img.className = 'w-5 h-5 rounded shrink-0'
    img.onerror = () => { img.style.display = 'none' }

    const info = document.createElement('div')
    info.className = 'flex-1 min-w-0'

    const nameP = document.createElement('p')
    nameP.className = 'text-[13px] text-gray-700 font-medium truncate'
    nameP.textContent = hostname

    const timeP = document.createElement('p')
    timeP.className = 'text-[11px] text-gray-400'
    timeP.textContent = t('lastSynced', time)

    info.append(nameP, timeP)

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'delete-origin-btn opacity-0 group-hover:opacity-100 shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all'
    deleteBtn.title = t('deleteSite')
    deleteBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>'

    deleteBtn.addEventListener('click', async () => {
      if (!confirm(t('confirmDelete', hostname))) return

      deleteBtn.classList.add('pointer-events-none', 'opacity-50')
      const delRes = await sendToBackground('DELETE_ORIGIN', { origin: item.origin })
      if (delRes.success) {
        toast(t('deleteSuccess'), true)
        void loadSyncedSites()
      } else {
        toast(t('deleteFailed'), false)
        deleteBtn.classList.remove('pointer-events-none', 'opacity-50')
      }
    })

    li.append(img, info, deleteBtn)
    sitesList.appendChild(li)
  })
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '< 1 min'
  if (m < 60) return `${m} min`
  const h = Math.floor(diff / 3600000)
  if (h < 24) return `${h}h`
  const d = Math.floor(diff / 86400000)
  if (d < 30) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

// ── Key toggle & copy ───────────────────────────────────────────

toggleKeyBtn.addEventListener('click', () => { if (keyVisible) maskKey(); else revealKey() })
copyKeyBtn.addEventListener('click', async () => { if (fullKey) await navigator.clipboard.writeText(fullKey) })
