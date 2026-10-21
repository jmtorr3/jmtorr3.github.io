import { useEffect, useRef } from 'react'
import { powerButtonOnScreen } from './PCModel'

// While Slumpy is shut down: a bobbing arrow beside the power button on the
// case, following it as the camera moves. Tapping it presses the button too.
export function PowerHint() {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    let id = 0
    const follow = () => {
      const el = ref.current
      if (el) {
        el.style.display = powerButtonOnScreen.visible ? '' : 'none'
        el.style.transform = `translate(${powerButtonOnScreen.x}px, ${powerButtonOnScreen.y}px)`
      }
      id = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <button ref={ref} className="power-hint" style={{ display: 'none' }} onClick={() => window.dispatchEvent(new Event('press-power'))}>
      <span>◀ power</span>
    </button>
  )
}
