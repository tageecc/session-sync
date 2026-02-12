import { getConfig, getCachedPlan, getUpgradeUrl, HAS_UPGRADE, FREE_PLAN_LIMIT } from '../shared/config'
import { deriveUserHash } from '../shared/crypto'
import { sendToBackground } from '../shared/messaging'
import { t, applyI18n } from '../shared/i18n'
import { toast } from '../shared/toast'

// ── DOM references ──────────────────────────────────────────────

const currentKeyEl = document.getElementById('current-key')!
const toggleKeyBtn = document.getElementById('toggle-key-btn') as HTMLButtonElement
const copyKeyBtn = document.getElementById('copy-key-btn') as HTMLButtonElement

const planFreeView = document.getElementById('plan-free-view')!
const planProView = document.getElementById('plan-pro-view')!
const usageText = document.getElementById('usage-text')!
const usageBar = document.getElementById('usage-bar')!
const proCard = document.getElementById('pro-card')!
const upgradeProBtn = document.getElementById('upgrade-pro-btn') as HTMLButtonElement
const refreshPlanBtn = document.getElementById('refresh-plan-btn') as HTMLButtonElement

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
  void initPlanStatus()
}

init()

// ── Plan status ──────────────────────────────────────────────────

function renderPlan(plan: string, used: number, limit: number) {
  if (plan === 'pro') {
    planFreeView.classList.add('hidden')
    planProView.classList.remove('hidden')
  } else {
    planFreeView.classList.remove('hidden')
    planProView.classList.add('hidden')

    // Usage bar
    usageText.textContent = `${used}/${limit}`
    const percent = Math.min((used / limit) * 100, 100)
    usageBar.style.width = `${percent}%`

    // Color: green → yellow → red based on usage
    if (percent >= 100) {
      usageBar.className = 'h-full bg-red-500 rounded-full transition-all duration-500'
    } else if (percent >= 66) {
      usageBar.className = 'h-full bg-amber-500 rounded-full transition-all duration-500'
    } else {
      usageBar.className = 'h-full bg-sky-500 rounded-full transition-all duration-500'
    }

    // Show Pro card if upgrade is available
    if (HAS_UPGRADE) {
      proCard.classList.remove('hidden')
    }
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

// ── Synced sites list ────────────────────────────────────────────

const sitesLoading = document.getElementById('sites-loading')!
const sitesEmpty = document.getElementById('sites-empty')!
const sitesList = document.getElementById('sites-list')!

async function loadSyncedSites() {
  const res = await sendToBackground('LIST_ORIGINS')

  sitesLoading.classList.add('hidden')

  if (!res.success || !res.data?.length) {
    sitesEmpty.classList.remove('hidden')
    return
  }

  const origins = res.data as Array<{ origin: string; updated_at: string }>
  sitesList.classList.remove('hidden')

  sitesList.innerHTML = origins.map((item) => {
    const hostname = new URL(item.origin).hostname
    const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
    const time = formatRelativeTime(item.updated_at)

    return `
      <li class="flex items-center gap-3 py-2.5 group">
        <img src="${favicon}" alt="" class="w-5 h-5 rounded shrink-0" onerror="this.style.display='none'">
        <div class="flex-1 min-w-0">
          <p class="text-[13px] text-gray-700 font-medium truncate">${hostname}</p>
          <p class="text-[11px] text-gray-400">${t('lastSynced', time)}</p>
        </div>
        <button class="delete-origin-btn opacity-0 group-hover:opacity-100 shrink-0 w-7 h-7 flex items-center justify-center
                       rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                data-origin="${item.origin}" title="${t('deleteSite')}">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </li>
    `
  }).join('')

  // Bind delete handlers
  sitesList.querySelectorAll('.delete-origin-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLElement
      const origin = target.dataset.origin!
      const hostname = new URL(origin).hostname

      if (!confirm(t('confirmDelete', hostname))) return

      target.classList.add('pointer-events-none', 'opacity-50')
      const res = await sendToBackground('DELETE_ORIGIN', { origin })

      if (res.success) {
        toast(t('deleteSuccess'), true)
        // Reload sites and refresh plan
        void loadSyncedSites()
        void initPlanStatus()
      } else {
        toast(t('deleteFailed'), false)
        target.classList.remove('pointer-events-none', 'opacity-50')
      }
    })
  })
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then

  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)

  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${minutes} min`
  if (hours < 24) return `${hours}h`
  if (days < 30) return `${days}d`
  return new Date(isoString).toLocaleDateString()
}

void loadSyncedSites()

// ── Key visibility toggle ───────────────────────────────────────

toggleKeyBtn.addEventListener('click', () => {
  if (keyVisible) maskKey(); else revealKey()
})

// ── Copy key ────────────────────────────────────────────────────

copyKeyBtn.addEventListener('click', async () => {
  if (!fullKey) return
  await navigator.clipboard.writeText(fullKey)
})
