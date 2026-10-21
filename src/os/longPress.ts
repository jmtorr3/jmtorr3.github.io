// Long-press on a touch screen acts as a right-click: after holding still for a
// moment, a contextmenu event is fired where the finger is, so every right-click
// menu on the site works on phones (iOS never sends contextmenu by itself).

const HOLD_MS = 500
const SLOP = 10 // px the finger may wander before it counts as a drag

let timer = 0
let start: { x: number; y: number; target: EventTarget | null } | null = null
let firedAt = -Infinity

const cancel = () => {
  clearTimeout(timer)
  start = null
}

window.addEventListener(
  'pointerdown',
  (e) => {
    if (e.pointerType !== 'touch' || !e.isPrimary) return
    cancel()
    start = { x: e.clientX, y: e.clientY, target: e.target }
    timer = window.setTimeout(() => {
      if (!start) return
      const { x, y, target } = start
      start = null
      firedAt = performance.now()
      navigator.vibrate?.(12)
      ;(target as Element).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }))
    }, HOLD_MS)
  },
  true,
)

window.addEventListener(
  'pointermove',
  (e) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP) cancel()
  },
  true,
)

for (const type of ['pointerup', 'pointercancel', 'scroll'] as const) window.addEventListener(type, cancel, true)

const justFired = () => performance.now() - firedAt < 800

// the finger lifting after a long-press isn't a tap: don't open/click what's under it
window.addEventListener(
  'click',
  (e) => {
    if (!justFired()) return
    e.preventDefault()
    e.stopPropagation()
  },
  true,
)

// Android sends its own contextmenu on long-press too: skip that one
window.addEventListener(
  'contextmenu',
  (e) => {
    if (e.isTrusted && justFired()) {
      e.preventDefault()
      e.stopPropagation()
    }
  },
  true,
)
