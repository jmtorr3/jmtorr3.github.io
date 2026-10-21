import { useEffect, useRef } from 'react'
import type { MochiFace } from '../scene/MochiFace'

type Point = { x: number; y: number }

const rand = (a: number, b: number) => a + Math.random() * (b - a)

// The Mochi face as a little sprite floating over an app (the Konsole uses it).
// It wanders around its parent on its own; when `follow` returns a point (the
// top-left it should sit at, in the parent's px), it hurries over there instead.
// It can be dragged: wherever it's dropped becomes its spot, where it stays
// (it still pops over while `follow` wants it, then comes back).
export function MochiCam({
  face,
  follow,
  onClick,
}: {
  face: MochiFace
  follow?: () => Point | null
  onClick?: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const followRef = useRef(follow)
  followRef.current = follow
  const clickRef = useRef(onClick)
  clickRef.current = onClick

  useEffect(() => {
    const el = host.current
    if (!el) return
    el.appendChild(face.canvas)
    face.set(null) // wake up

    const pos: Point = { x: -1, y: 0 }
    let target: Point = { x: 0, y: 0 }
    let wanderAt = 0
    let home: Point | null = null // where the user dropped it
    let raf = 0
    let last = performance.now()

    // dragging, in the parent's layout px (the desktop is CSS-scaled)
    let drag: { id: number; dx: number; dy: number; x0: number; y0: number; moved: boolean } | null = null
    const toLocal = (e: PointerEvent) => {
      const parent = el.parentElement!
      const r = parent.getBoundingClientRect()
      const s = r.width / parent.offsetWidth || 1
      return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }
    }
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      const p = toLocal(e)
      drag = { id: e.pointerId, dx: p.x - pos.x, dy: p.y - pos.y, x0: e.clientX, y0: e.clientY, moved: false }
      el.setPointerCapture(e.pointerId)
      e.preventDefault()
    }
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4) return
      if (!drag.moved) {
        drag.moved = true
        face.react('surprised', 1e9) // whoa
        el.classList.add('dragging')
      }
      const p = toLocal(e)
      pos.x = p.x - drag.dx
      pos.y = p.y - drag.dy
    }
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const moved = drag.moved
      drag = null
      el.classList.remove('dragging')
      if (!moved) return clickRef.current?.() // a tap, not a drag: petting
      home = { ...pos }
      target = { ...pos }
      face.react('happy', 1.2)
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      face.update(dt)

      const parent = el.parentElement
      if (parent) {
        // room to move in, in layout px (unaffected by the desktop's CSS scale)
        const maxX = Math.max(0, parent.clientWidth - el.offsetWidth)
        const maxY = Math.max(0, parent.clientHeight - el.offsetHeight)
        if (pos.x < 0) Object.assign(pos, { x: maxX, y: 0 }) // start in the top-right corner
        const clamp = (p: Point) => ({ x: Math.min(maxX, Math.max(0, p.x)), y: Math.min(maxY, Math.max(0, p.y)) })

        if (drag?.moved) {
          Object.assign(pos, clamp(pos)) // held: right where the pointer is
        } else {
          const want = followRef.current?.()
          if (want) target = want
          else if (home) target = home
          else if (now > wanderAt) {
            target = { x: rand(0, maxX), y: rand(0, maxY) }
            wanderAt = now + rand(2500, 6000)
          }
          target = clamp(target)

          // glide toward the target: quick when following or going home, a slow drift when wandering
          const dx = target.x - pos.x
          const dy = target.y - pos.y
          const dist = Math.hypot(dx, dy)
          if (dist > 0.5) {
            const step = Math.min(dist, (want || home ? 320 : 50) * dt)
            pos.x += (dx / dist) * step
            pos.y += (dy / dist) * step
            // look where it's heading while wandering
            if (!want && !home) face.glance((dx / dist) * 10, (dy / dist) * 5, 0.3)
          }
        }
        const bob = drag?.moved ? 0 : Math.sin(now / 320) * 2
        el.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y + bob)}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      face.canvas.remove()
    }
  }, [face])

  return <div className="mochi-cam" ref={host} aria-hidden />
}
