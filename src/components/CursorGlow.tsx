import { useEffect, useRef } from 'react'
import './CursorGlow.css'

export default function CursorGlow() {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(pointer: fine)').matches) return

    const el = ref.current
    if (!el) return

    let x = window.innerWidth / 2
    let y = window.innerHeight / 2
    let frame = 0

    const apply = () => {
      frame = 0
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
    }

    const onMove = (e: MouseEvent) => {
      x = e.clientX
      y = e.clientY
      el.classList.remove('hidden')
      if (!frame) frame = requestAnimationFrame(apply)
    }

    const onDown = () => {
      el.classList.remove('expanding')
      void el.offsetWidth
      el.classList.add('expanding')
    }

    const onAnimEnd = () => el.classList.remove('expanding')

    const interactiveSelector = 'a, button, [role="button"], summary, label[for], input, select, textarea'
    const onOver = (e: MouseEvent) => {
      const t = e.target as Element | null
      if (t && t.closest && t.closest(interactiveSelector)) {
        el.classList.add('over-link')
      } else {
        el.classList.remove('over-link')
      }
    }

    const onLeave = () => el.classList.add('hidden')
    const onDocOut = (e: MouseEvent) => {
      if (!e.relatedTarget && !(e as MouseEvent & { toElement?: Element }).toElement) {
        el.classList.add('hidden')
      }
    }

    apply()
    el.classList.add('hidden')
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onDocOut)
    window.addEventListener('blur', onLeave)
    el.addEventListener('animationend', onAnimEnd)

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onDocOut)
      window.removeEventListener('blur', onLeave)
      el.removeEventListener('animationend', onAnimEnd)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return <div ref={ref} className="cursor-glow" aria-hidden="true" />
}
