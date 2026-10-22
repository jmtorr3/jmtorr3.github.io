import { create } from 'zustand'

// "Fit to screen" (Start menu): the desktop leaves the 3D monitor's 5:4 screen and
// fills the whole window, laid out at the window's own aspect ratio. Remembered in
// this browser. (Phones are always full screen, so it doesn't apply there.)

const KEY = 'fit-screen'
const load = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export const useFit = create<{ fit: boolean }>(() => ({ fit: load() }))

export function toggleFit() {
  const fit = !useFit.getState().fit
  useFit.setState({ fit })
  try {
    localStorage.setItem(KEY, fit ? '1' : '0')
  } catch {
    // storage blocked: it just won't be remembered
  }
}

type Rect = { left: number; top: number; width: number; height: number }

// The move between the monitor's screen and the whole window. The desktop is laid
// out at its new size straight away; this starts it drawn over the old rect (one
// even scale, so nothing gets squashed, with whatever doesn't fit there clipped
// off the sides) and eases it into place.
export function animateFit(el: HTMLElement, from: Rect, to: Rect) {
  if (!to.width || !to.height || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const k = Math.max(from.width / to.width, from.height / to.height)
  const clipX = Math.max(0, (to.width - from.width / k) / 2)
  const clipY = Math.max(0, (to.height - from.height / k) / 2)
  const tx = from.left + from.width / 2 - (to.left + (to.width * k) / 2)
  const ty = from.top + from.height / 2 - (to.top + (to.height * k) / 2)
  el.animate(
    [
      { transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${k})`, clipPath: `inset(${clipY}px ${clipX}px)` },
      { transformOrigin: '0 0', transform: 'none', clipPath: 'inset(0px 0px)' },
    ],
    { duration: 650, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  )
}
