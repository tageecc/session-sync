import { getConfig, getCachedPlan, cachePlan, getUpgradeUrl, HAS_UPGRADE, FREE_PLAN_LIMIT, type PlanInfo } from '../shared/config'
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
const planBadge = document.getElementById('plan-badge')!
const usageRow = document.getElementById('usage-row')!
const usageBar = document.getElementById('usage-bar')!
const usageText = document.getElementById('usage-text')!
const sitesLoading = document.getElementById('sites-loading')!
const sitesEmpty = document.getElementById('sites-empty')!
const sitesEmptyText = document.getElementById('sites-empty-text')!
const sitesList = document.getElementById('sites-list')!

const proBanner = document.getElementById('pro-banner')!
const proHeadline = document.getElementById('pro-headline')!
const proDesc = document.getElementById('pro-desc')!
const upgradeProBtn = document.getElementById('upgrade-pro-btn') as HTMLButtonElement
const refreshPlanBtn = document.getElementById('refresh-plan-btn') as HTMLButtonElement

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
proHeadline.textContent = t('upgradeToPro')
proDesc.textContent = [t('proBenefit1'), t('proBenefit2'), t('proBenefit3')].join(' · ')
upgradeProBtn.textContent = t('upgradeAction')
refreshPlanBtn.textContent = t('restorePurchase')

async function init() {
  const config = await getConfig()
  if (config?.passphrase) {
    fullKey = config.passphrase
    maskKey()
  }
  // Direct Supabase calls — no background messaging needed for reads
  initPlanStatus().catch((e) => console.error('[Options] initPlanStatus error:', e))
  loadSyncedSites().catch((e) => console.error('[Options] loadSyncedSites error:', e))
}

init()

// ── Supabase helper ─────────────────────────────────────────────

async function getUserHash(): Promise<string | null> {
  const config = await getConfig()
  if (!config?.passphrase) return null
  return deriveUserHash(config.passphrase)
}

// ── Plan (direct Supabase call) ─────────────────────────────────

function renderPlan(plan: string, used: number, limit: number) {
  if (plan === 'pro') {
    planBadge.textContent = 'Pro'
    planBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700'
    usageRow.classList.add('hidden')
    proBanner.classList.add('hidden')
  } else {
    planBadge.textContent = t('planFree')
    planBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500'
    usageRow.classList.remove('hidden')
    usageText.textContent = `${used} / ${limit}`

    const pct = Math.min((used / limit) * 100, 100)
    requestAnimationFrame(() => { usageBar.style.width = `${pct}%` })

    if (pct >= 100) usageBar.className = 'h-full bg-red-400 rounded-full transition-all duration-700 ease-out'
    else if (pct >= 66) usageBar.className = 'h-full bg-amber-400 rounded-full transition-all duration-700 ease-out'
    else usageBar.className = 'h-full bg-sky-400 rounded-full transition-all duration-700 ease-out'

    proBanner.classList.remove('hidden')
    if (!HAS_UPGRADE) upgradeProBtn.classList.add('hidden')
  }
}

async function fetchPlanDirect(): Promise<PlanInfo> {
  const userHash = await getUserHash()
  if (!userHash) return { plan: 'free', origin_used: 0, origin_limit: FREE_PLAN_LIMIT }

  const supabase = await getSupabaseClient()
  const { data, error } = await supabase
    .rpc('get_plan_info', { p_user_hash: userHash })
    .maybeSingle()

  if (error) {
    if (HAS_UPGRADE) return { plan: 'free', origin_used: 0, origin_limit: FREE_PLAN_LIMIT }
    return { plan: 'pro', origin_used: 0, origin_limit: 999999 }
  }

  const row = data as { plan?: string; origin_used?: number; origin_limit?: number } | null
  return {
    plan: (row?.plan as PlanInfo['plan']) ?? 'free',
    origin_used: row?.origin_used ?? 0,
    origin_limit: row?.origin_limit ?? FREE_PLAN_LIMIT,
  }
}

async function initPlanStatus() {
  const cached = await getCachedPlan()
  renderPlan(cached?.plan ?? 'free', cached?.origin_used ?? 0, cached?.origin_limit ?? FREE_PLAN_LIMIT)

  const plan = await fetchPlanDirect()
  await cachePlan(plan)
  renderPlan(plan.plan, plan.origin_used, plan.origin_limit)
}

upgradeProBtn.addEventListener('click', async () => {
  const userHash = await getUserHash()
  if (!userHash) return
  const url = `${getUpgradeUrl()}?client_reference_id=${encodeURIComponent(userHash)}`
  window.open(url, '_blank')
})

refreshPlanBtn.addEventListener('click', async () => {
  refreshPlanBtn.textContent = t('refreshingPlan')
  refreshPlanBtn.classList.add('pointer-events-none')
  const plan = await fetchPlanDirect()
  await cachePlan(plan)
  renderPlan(plan.plan, plan.origin_used, plan.origin_limit)
  toast(t('planRefreshed'), true)
  refreshPlanBtn.textContent = t('restorePurchase')
  refreshPlanBtn.classList.remove('pointer-events-none')
})

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

  sitesList.innerHTML = origins.map((item, i) => {
    const hostname = new URL(item.origin).hostname
    const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
    const time = formatRelativeTime(item.updated_at)

    return `
      <li class="flex items-center gap-3 py-2.5 px-1 group fade-up" style="animation-delay:${i * 40}ms">
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

  sitesList.querySelectorAll('.delete-origin-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLElement
      const origin = target.dataset.origin!
      const hostname = new URL(origin).hostname
      if (!confirm(t('confirmDelete', hostname))) return

      target.classList.add('pointer-events-none', 'opacity-50')
      const delRes = await sendToBackground('DELETE_ORIGIN', { origin })
      if (delRes.success) {
        toast(t('deleteSuccess'), true)
        void loadSyncedSites()
        void initPlanStatus()
      } else {
        toast(t('deleteFailed'), false)
        target.classList.remove('pointer-events-none', 'opacity-50')
      }
    })
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
