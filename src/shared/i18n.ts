// Bundled fallback messages (imported at build time via Vite)
import zhCN from '../../public/_locales/zh_CN/messages.json'
import en from '../../public/_locales/en/messages.json'

type MessageCatalog = Record<string, { message: string; placeholders?: Record<string, { content: string }> }>

const lang = chrome.i18n.getUILanguage()
const fallback: MessageCatalog = lang.startsWith('zh') ? zhCN : en

/** Resolve a message with optional substitution placeholders */
function resolve(key: string, subs?: string | string[]): string {
  // 1. Try Chrome's native API first
  const native = chrome.i18n.getMessage(key, subs)
  if (native) return native

  // 2. Fallback to bundled JSON
  const entry = fallback[key]
  if (!entry) return key

  let msg = entry.message
  if (subs) {
    const arr = Array.isArray(subs) ? subs : [subs]
    // Replace $1, $2, ... and named placeholders
    arr.forEach((val, i) => {
      msg = msg.replace(new RegExp(`\\$${i + 1}`, 'g'), val)
    })
    if (entry.placeholders) {
      for (const [name, ph] of Object.entries(entry.placeholders)) {
        const idx = parseInt(ph.content.replace('$', ''), 10)
        if (!isNaN(idx) && arr[idx - 1] !== undefined) {
          msg = msg.replace(new RegExp(`\\$${name}\\$`, 'gi'), arr[idx - 1])
        }
      }
    }
  }
  return msg
}

/** Shorthand for getting a translated message */
export function t(key: string, substitutions?: string | string[]): string {
  return resolve(key, substitutions)
}

/** Apply translations to all elements with data-i18n* attributes */
export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const msg = t(el.dataset.i18n!)
    if (msg) el.textContent = msg
  })

  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    const msg = t(el.dataset.i18nHtml!)
    if (msg) el.innerHTML = msg
  })

  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const msg = t(el.dataset.i18nTitle!)
    if (msg) el.title = msg
  })

  document.documentElement.lang = lang
}
