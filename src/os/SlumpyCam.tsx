import { useEffect, useRef } from 'react'
import type { SlumpyFace } from '../scene/SlumpyFace'
import { playBoing } from './sound'

type Point = { x: number; y: number }

// lets the app steer the sprite (the Konsole's "Call Slumpy Here")
export type SlumpyControl = { comeTo?: (x: number, y: number) => void }

const rand = (a: number, b: number) => a + Math.random() * (b - a)

// The Slumpy face as a little sprite floating over an app (the Konsole uses it).
// It wanders around its parent on its own; when `follow` returns a point (the
// top-left it should sit at, in the parent's px), it hurries over there instead.
// It can be dragged: wherever it's dropped becomes its spot, where it stays
// (it still pops over while `follow` wants it, then comes back). Fling it and it
// flies off, bouncing around the edges until it slows to a stop, then roams again.
export function SlumpyCam({
  face,
  follow,
  onClick,
  control,
}: {
  face: SlumpyFace
  follow?: () => Point | null
  onClick?: () => void
  control?: { current: SlumpyControl }
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
    // flinging: velocity in px/s, tracked while dragging and carried after release
    const vel: Point = { x: 0, y: 0 }
    let lastMove = { x: 0, y: 0, t: 0 }
    let flying = false
    let bounces = 0
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
      flying = false
      vel.x = vel.y = 0
      lastMove = { ...p, t: e.timeStamp }
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
      const dt = (e.timeStamp - lastMove.t) / 1000
      if (dt > 0) {
        vel.x = vel.x * 0.5 + ((p.x - lastMove.x) / dt) * 0.5
        vel.y = vel.y * 0.5 + ((p.y - lastMove.y) / dt) * 0.5
      }
      lastMove = { ...p, t: e.timeStamp }
    }
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const moved = drag.moved
      drag = null
      el.classList.remove('dragging')
      if (!moved) return clickRef.current?.() // a tap, not a drag: petting
      // held still before letting go: a drop, not a throw
      if (e.timeStamp - lastMove.t > 80) vel.x = vel.y = 0
      if (Math.hypot(vel.x, vel.y) > 300) {
        flying = true
        bounces = 0
        return // keeps the surprised face until it lands
      }
      land()
    }
    // set down: a gentle drop makes this its spot; after a throw it's free to roam again
    const land = () => {
      const thrown = flying
      flying = false
      home = thrown ? null : { ...pos }
      target = { ...pos }
      wanderAt = performance.now() + rand(1500, 3000) // catch its breath before wandering off
      if (bounces >= 3) face.react('dizzy', 2.2)
      else face.react('happy', 1.2)
    }
    // fly over and settle with its face centered on (x, y), in the parent's px
    if (control)
      control.current.comeTo = (x, y) => {
        flying = false
        home = { x: x - el.offsetWidth / 2, y: y - el.offsetHeight / 2 }
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
        } else if (flying) {
          // thrown: fly, slow down, bounce off the edges
          pos.x += vel.x * dt
          pos.y += vel.y * dt
          const friction = Math.exp(-dt * 1.6)
          vel.x *= friction
          vel.y *= friction
          const bounce = (axis: 'x' | 'y', max: number) => {
            if (pos[axis] >= 0 && pos[axis] <= max) return
            pos[axis] = pos[axis] < 0 ? 0 : max
            const hit = Math.abs(vel[axis])
            vel[axis] = -vel[axis] * 0.75
            bounces++
            if (hit > 80) playBoing(hit / 1500)
          }
          bounce('x', maxX)
          bounce('y', maxY)
          if (Math.hypot(vel.x, vel.y) < 40) land()
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
        const bob = drag?.moved || flying ? 0 : Math.sin(now / 320) * 2
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
      if (control) control.current.comeTo = undefined
      face.canvas.remove()
    }
  }, [face, control])

  return <div className="slumpy-cam" ref={host} aria-hidden />
}
