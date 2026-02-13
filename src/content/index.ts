chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_STORAGE') {
    sendResponse({
      success: true,
      data: {
        localStorage: readStorage(localStorage),
        sessionStorage: readStorage(sessionStorage),
      },
    })
    return true
  }
  if (message.type === 'SET_STORAGE') {
    writeStorage(localStorage, message.payload?.localStorage)
    writeStorage(sessionStorage, message.payload?.sessionStorage)
    sendResponse({ success: true })
    return true
  }
})

function readStorage(storage: Storage): Array<{ key: string; value: string }> {
  const entries: Array<{ key: string; value: string }> = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)!
    entries.push({ key, value: storage.getItem(key) ?? '' })
  }
  return entries
}

function writeStorage(storage: Storage, entries?: Array<{ key: string; value: string }>) {
  if (!entries?.length) return
  storage.clear()
  entries.forEach(({ key, value }) => storage.setItem(key, value))
}

export {}
