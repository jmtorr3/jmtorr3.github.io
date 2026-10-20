import { useEffect, useRef } from 'react'
import type { MochiFace } from '../scene/MochiFace'

// The Mochi face as a little screen inside an app (the Konsole uses it).
// The face draws on its own canvas; this mounts it and keeps it animating.
export function MochiCam({ face, onClick }: { face: MochiFace; onClick?: () => void }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    host.current?.appendChild(face.canvas)
    face.set(null) // wake up
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      face.update(Math.min((now - last) / 1000, 0.1))
      last = now
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
