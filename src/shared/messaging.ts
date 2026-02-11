// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MessageResponse = { success: boolean; data?: any; error?: string }

/** Send a message to the background service worker */
export function sendToBackground(type: string, payload?: unknown): Promise<MessageResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      resolve(chrome.runtime.lastError
        ? { success: false, error: chrome.runtime.lastError.message }
        : response)
    })
  })
}

/** Send a message to a content script in the specified tab */
export function sendToTab(tabId: number, type: string, payload?: unknown): Promise<MessageResponse> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type, payload }, (response) => {
      resolve(chrome.runtime.lastError
        ? { success: false, error: chrome.runtime.lastError.message }
        : response)
    })
  })
}
