import { useEffect, useRef } from 'react'
import type { MochiFace } from '../scene/MochiFace'

type Point = { x: number; y: number }

const rand = (a: number, b: number) => a + Math.random() * (b - a)

// The Mochi face as a little sprite floating over an app (the Konsole uses it).
// It wanders around its parent on its own; when `follow` returns a point (the
// top-left it should sit at, in the parent's px), it hurries over there instead.
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

  useEffect(() => {
    const el = host.current
    if (!el) return
    el.appendChild(face.canvas)
    face.set(null) // wake up

    const pos: Point = { x: -1, y: 0 }
    let target: Point = { x: 0, y: 0 }
    let wanderAt = 0
    let raf = 0
    let last = performance.now()

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
        const want = followRef.current?.()
        if (want) target = want
        else if (now > wanderAt) {
          target = { x: rand(0, maxX), y: rand(0, maxY) }
          wanderAt = now + rand(2500, 6000)
        }
        target = { x: Math.min(maxX, Math.max(0, target.x)), y: Math.min(maxY, Math.max(0, target.y)) }

        // glide toward the target: quick when following, a slow drift when wandering
        const dx = target.x - pos.x
        const dy = target.y - pos.y
        const dist = Math.hypot(dx, dy)
        if (dist > 0.5) {
          const step = Math.min(dist, (want ? 320 : 50) * dt)
          pos.x += (dx / dist) * step
          pos.y += (dy / dist) * step
          // look where it's heading while wandering
          if (!want) face.glance((dx / dist) * 10, (dy / dist) * 5, 0.3)
        }
        const bob = Math.sin(now / 320) * 2
        el.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y + bob)}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      face.canvas.remove()
    }
  }, [face])

  return <div className="mochi-cam" ref={host} onClick={onClick} aria-hidden />
}
