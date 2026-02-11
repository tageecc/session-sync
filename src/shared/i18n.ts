/** Shorthand for chrome.i18n.getMessage with fallback to key name */
export function t(key: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(key, substitutions) || key
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

  document.documentElement.lang = chrome.i18n.getUILanguage()
}
