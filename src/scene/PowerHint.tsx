import { useEffect, useRef } from 'react'
import { powerButtonOnScreen } from './PCModel'

// While Slumpy is shut down: a pulsing ring round the power button on the case and
// a "power" badge pointing at it, following it as the camera moves. The badge goes
// on whichever side of the button it fits (the right, unless that runs off the
// screen) and stays on screen. Tapping it presses the button too.
const GAP = 14 // between the button and the badge (px)
const MARGIN = 10 // kept clear of the screen's edges (px)

export function PowerHint() {
  const ring = useRef<HTMLSpanElement>(null)
  const badge = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    let id = 0
    const follow = () => {
      const r = ring.current
      const el = badge.current
      if (r && el) {
        const { x, y, visible } = powerButtonOnScreen
        r.style.display = el.style.display = visible ? '' : 'none'
        if (visible) {
          r.style.transform = `translate(${x}px, ${y}px)`
          const w = el.offsetWidth
          const h = el.offsetHeight
          const right = x + GAP + w <= window.innerWidth - MARGIN
          el.dataset.side = right ? 'right' : 'left'
          const left = Math.min(window.innerWidth - MARGIN - w, Math.max(MARGIN, right ? x + GAP : x - GAP - w))
          const top = Math.min(window.innerHeight - MARGIN - h, Math.max(MARGIN, y - h / 2))
          el.style.transform = `translate(${left}px, ${top}px)`
        }
      }
      id = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <>
      <span ref={ring} className="power-ring" style={{ display: 'none' }} aria-hidden />
      <button ref={badge} className="power-hint" style={{ display: 'none' }} onClick={() => window.dispatchEvent(new Event('press-power'))}>
        <span className="arrow-left">◀</span> power <span className="arrow-right">▶</span>
      </button>
    </>
  )
}
