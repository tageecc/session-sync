// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface MessageResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

/** Send a message to the background service worker */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sendToBackground<T = any>(type: string, payload?: unknown): Promise<MessageResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      resolve(chrome.runtime.lastError
        ? { success: false, error: chrome.runtime.lastError.message }
        : response)
    })
  })
}
