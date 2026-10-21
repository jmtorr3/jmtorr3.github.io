import { useEffect, useRef } from 'react'
import { SlumpyFace } from '../scene/SlumpyFace'

// Slumpy's face on a little black screen, idling through its moods.
// Size and framing come from the className. transparent: no screen, just the
// face with a dark outline (the wallpaper).
export function FaceScreen({ className, transparent = false }: { className?: string; transparent?: boolean }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const face = new SlumpyFace({ transparent })
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
      face.texture.dispose()
    }
  }, [transparent])

  return <div className={`face-screen ${className ?? ''}`} ref={host} aria-hidden />
}
