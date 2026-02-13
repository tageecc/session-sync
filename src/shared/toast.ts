/** Show a temporary toast notification */
export function toast(msg: string, ok: boolean): void {
  document.getElementById('_toast')?.remove()
  const el = document.createElement('div')
  el.id = '_toast'
  el.role = 'alert'
  el.setAttribute('aria-live', 'polite')
  el.className = `fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-xs font-medium shadow-lg whitespace-nowrap ${
    ok ? 'bg-emerald-500' : 'bg-red-500'
  } text-white`
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transition = 'opacity 0.3s'
    setTimeout(() => el.remove(), 300)
  }, 2200)
}
